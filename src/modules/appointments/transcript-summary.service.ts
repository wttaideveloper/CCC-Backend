import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranscriptSummaryDto } from './dto/appointment.dto';

type SummaryModelClient = {
    modelName: string;
    summarize(prompt: string, timeoutMs: number): Promise<string>;
};

@Injectable()
export class TranscriptSummaryService {
    private readonly logger = new Logger(TranscriptSummaryService.name);

    constructor(private readonly configService: ConfigService) { }

    get modelName(): string {
        return this.getModelClient().modelName;
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
        const prompt = this.buildPrompt(input);
        const client = this.getModelClient();

        let lastError: unknown = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const raw = await client.summarize(prompt, timeoutMs);
                return this.extractAndValidateSummary(raw);
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

    private buildPrompt(transcript: string): string {
        return [
            'Generate structured mentorship session summary with clear section headings: Session Overview, Key Discussion Points, Mentor Guidance, Action Items, and Follow-up.',
            'Return strict JSON only. Do not include markdown fences or any prose outside JSON.',
            'Use this exact schema:',
            '{"sessionOverview":"string","keyDiscussionPoints":["string"],"mentorGuidance":["string"],"actionItems":["string"],"followUp":"string"}',
            'If data is missing for a section, use an empty string or empty array.',
            '',
            'Transcript:',
            transcript,
        ].join('\n');
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

    private getModelClient(): SummaryModelClient {
        const provider = (this.configService.get<string>('SUMMARY_MODEL_PROVIDER') ?? 'hf').toLowerCase();
        if (provider === 'hf') {
            return this.getHuggingFaceClient();
        }
        return this.getHeuristicClient();
    }

    /**
     * Cloud Hugging Face: legacy api-inference.huggingface.co is gone (410).
     * - No SUMMARY_MODEL_API_URL → OpenAI-compatible Inference Providers router.
     * - SUMMARY_MODEL_API_URL set → legacy { inputs, parameters } body (local FastAPI / TGI, etc.).
     */
    private getHuggingFaceClient(): SummaryModelClient {
        const apiKey = this.configService.get<string>('HF_API_KEY') ?? '';
        const modelId = this.configService.get<string>('SUMMARY_MODEL_ID') ?? 'google/flan-t5-base';
        const customUrl = this.configService.get<string>('SUMMARY_MODEL_API_URL')?.trim();

        if (customUrl) {
            return this.getLegacyHuggingFaceStyleClient(customUrl, modelId, apiKey);
        }

        const routerUrl =
            this.configService.get<string>('SUMMARY_HF_ROUTER_URL')?.trim()
            ?? 'https://router.huggingface.co/v1/chat/completions';

        return {
            modelName: modelId,
            summarize: async (prompt: string, timeoutMs: number): Promise<string> => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);

                try {
                    const response = await fetch(routerUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                        },
                        body: JSON.stringify({
                            model: modelId,
                            messages: [{ role: 'user', content: prompt }],
                            max_tokens: this.getNumberEnv('SUMMARY_MODEL_MAX_NEW_TOKENS', 512),
                            temperature: 0.2,
                        }),
                        signal: controller.signal,
                    });

                    const payload = await response.json().catch(() => null);
                    if (!response.ok) {
                        throw new Error(`Model HTTP ${response.status}: ${JSON.stringify(payload)}`);
                    }

                    const content = payload?.choices?.[0]?.message?.content;
                    if (typeof content === 'string' && content.length > 0) {
                        return content;
                    }
                    if (typeof payload === 'string') return payload;
                    return JSON.stringify(payload);
                } finally {
                    clearTimeout(timer);
                }
            },
        };
    }

    /** Legacy body shape for local proxy (e.g. CCC-Ai-Model FastAPI /generate). */
    private getLegacyHuggingFaceStyleClient(apiUrl: string, modelId: string, apiKey: string): SummaryModelClient {
        return {
            modelName: modelId,
            summarize: async (prompt: string, timeoutMs: number): Promise<string> => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);

                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                        },
                        body: JSON.stringify({
                            inputs: prompt,
                            parameters: {
                                max_new_tokens: this.getNumberEnv('SUMMARY_MODEL_MAX_NEW_TOKENS', 512),
                                temperature: 0.2,
                                return_full_text: false,
                            },
                            options: {
                                wait_for_model: true,
                            },
                        }),
                        signal: controller.signal,
                    });

                    const payload = await response.json().catch(() => null);
                    if (!response.ok) {
                        throw new Error(`Model HTTP ${response.status}: ${JSON.stringify(payload)}`);
                    }

                    if (typeof payload === 'string') return payload;
                    if (Array.isArray(payload) && payload.length > 0) {
                        const first = payload[0];
                        if (typeof first === 'string') return first;
                        if (first?.generated_text) return String(first.generated_text);
                        return JSON.stringify(first);
                    }
                    if (payload?.generated_text) return String(payload.generated_text);
                    if (payload?.summary_text) return String(payload.summary_text);
                    return JSON.stringify(payload);
                } finally {
                    clearTimeout(timer);
                }
            },
        };
    }

    private getHeuristicClient(): SummaryModelClient {
        return {
            modelName: 'heuristic-fallback',
            summarize: async (prompt: string): Promise<string> => {
                const transcript = prompt.split('Transcript:').slice(1).join('Transcript:').trim();
                const sentences = transcript
                    .split(/\n+|(?<=[.!?])\s+/)
                    .map((s) => s.trim())
                    .filter(Boolean);

                const top = sentences.slice(0, 8);
                const json = {
                    sessionOverview: top.slice(0, 2).join(' ').slice(0, 400),
                    keyDiscussionPoints: top.slice(0, 4),
                    mentorGuidance: top.filter((line) => /advice|guidance|suggest|recommend|mentor/i.test(line)).slice(0, 4),
                    actionItems: top.filter((line) => /will|next|action|todo|follow/i.test(line)).slice(0, 4),
                    followUp: top.slice(4, 6).join(' ').slice(0, 300),
                };
                return JSON.stringify(json);
            },
        };
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
