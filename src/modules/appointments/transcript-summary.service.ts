import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranscriptSummaryDto } from './dto/appointment.dto';

@Injectable()
export class TranscriptSummaryService {
    private readonly logger = new Logger(TranscriptSummaryService.name);

    constructor(private readonly configService: ConfigService) { }

    get modelName(): string {
        return this.configService.get<string>('SUMMARY_MODEL_ID') ?? 'gpt-4.1-mini';
    }

    async summarizeTranscript(transcript: string): Promise<TranscriptSummaryDto> {
        const normalized = this.normalizeTranscript(transcript);
        const maxChars = this.getNumberEnv('SUMMARY_MAX_TRANSCRIPT_CHARS', 32000);
        const chunkChars = this.getNumberEnv('SUMMARY_CHUNK_CHARS', 6000);

        const bounded = normalized.slice(0, maxChars);
        const chunks = this.splitByChars(bounded, chunkChars);

        if (chunks.length === 1) {
            return this.summarizeSingle(chunks[0]);
        }

        const chunkSummaries: TranscriptSummaryDto[] = [];
        for (const chunk of chunks) {
            chunkSummaries.push(await this.summarizeSingle(chunk));
        }

        const mergedInput = [
            'Consolidate the following partial mentorship summaries into one final summary.',
            JSON.stringify(chunkSummaries),
        ].join('\n\n');

        return this.summarizeSingle(mergedInput);
    }

    private async summarizeSingle(input: string): Promise<TranscriptSummaryDto> {
        const timeoutMs = this.getNumberEnv('SUMMARY_MODEL_TIMEOUT_MS', 30000);
        const retries = this.getNumberEnv('SUMMARY_MODEL_RETRIES', 1);

        let lastError: unknown = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await this.callSummaryService(input, timeoutMs);
            } catch (error) {
                lastError = error;
                this.logger.warn(`Summary generation attempt ${attempt + 1} failed: ${(error as Error)?.message ?? error}`);
                if (attempt < retries) {
                    await this.delay(300 * (attempt + 1));
                }
            }
        }

        throw new UnprocessableEntityException(
            `Unable to generate valid transcript summary: ${(lastError as Error)?.message ?? lastError}`
        );
    }

    private extractAndValidateSummary(rawOutput: string): TranscriptSummaryDto {
        const parsed = this.tryParseJson(rawOutput);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Model response is not valid JSON');
        }

        const toStringArray = (value: unknown): string[] => {
            if (!Array.isArray(value)) return [];
            return value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
        };

        const summary: TranscriptSummaryDto = {
            sessionOverview: typeof (parsed as any).sessionOverview === 'string' ? (parsed as any).sessionOverview.trim() : '',
            keyDiscussionPoints: toStringArray((parsed as any).keyDiscussionPoints),
            mentorGuidance: toStringArray((parsed as any).mentorGuidance),
            actionItems: toStringArray((parsed as any).actionItems),
            followUp: typeof (parsed as any).followUp === 'string' ? (parsed as any).followUp.trim() : '',
        };

        const hasUsefulContent = !!(
            summary.sessionOverview ||
            summary.followUp ||
            summary.keyDiscussionPoints.length ||
            summary.mentorGuidance.length ||
            summary.actionItems.length
        );

        if (!hasUsefulContent) {
            throw new Error('Summary output is empty');
        }

        return summary;
    }

    private tryParseJson(rawOutput: string): unknown {
        try {
            return JSON.parse(rawOutput);
        } catch {
            const first = rawOutput.indexOf('{');
            const last = rawOutput.lastIndexOf('}');
            if (first < 0 || last <= first) return null;
            const slice = rawOutput.slice(first, last + 1);
            try {
                return JSON.parse(slice);
            } catch {
                return null;
            }
        }
    }

    private async callSummaryService(transcript: string, timeoutMs: number): Promise<TranscriptSummaryDto> {
        const serviceUrl =
            this.configService.get<string>('SUMMARY_SERVICE_URL')?.trim() ?? 'http://127.0.0.1:8080/summarize';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(serviceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript,
                    max_input_chars: this.getNumberEnv('SUMMARY_MAX_TRANSCRIPT_CHARS', 32000),
                    chunk_chars: this.getNumberEnv('SUMMARY_CHUNK_CHARS', 6000),
                }),
                signal: controller.signal,
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(`Summary service HTTP ${response.status}: ${JSON.stringify(payload)}`);
            }

            const summary = payload?.summary;
            if (!summary || typeof summary !== 'object') {
                throw new Error('Summary service response missing "summary" object');
            }

            return this.extractAndValidateSummary(JSON.stringify(summary));
        } finally {
            clearTimeout(timer);
        }
    }

    private splitByChars(text: string, chunkSize: number): string[] {
        if (text.length <= chunkSize) return [text];
        const chunks: string[] = [];
        let idx = 0;
        while (idx < text.length) {
            const end = Math.min(idx + chunkSize, text.length);
            chunks.push(text.slice(idx, end));
            idx = end;
        }
        return chunks;
    }

    private normalizeTranscript(transcript: string): string {
        return transcript.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    private getNumberEnv(name: string, fallback: number): number {
        const raw = this.configService.get<string>(name);
        const parsed = raw ? Number(raw) : NaN;
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private async delay(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

}
