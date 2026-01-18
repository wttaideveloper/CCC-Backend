import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateZoomMeetingDto, ZoomMeetingResponseDto, UpdateZoomMeetingDto } from './dto/zoom.dto';

@Injectable()
export class ZoomService {
    private readonly logger = new Logger(ZoomService.name);
    private readonly zoomApiBaseUrl = 'https://api.zoom.us/v2';
    private readonly zoomOAuthUrl = 'https://zoom.us/oauth/token';

    private accessToken: string | null = null;
    private tokenExpiresAt: Date | null = null;

    constructor(private readonly configService: ConfigService) {}

    /**
     * Get valid access token using Server-to-Server OAuth (recommended for backend)
     * Uses Account Credentials grant type
     */
    private async getAccessToken(): Promise<string> {
        // Check if we have a valid cached token (with 5 min buffer)
        if (this.accessToken && this.tokenExpiresAt) {
            const bufferTime = 5 * 60 * 1000; // 5 minutes
            if (new Date().getTime() < this.tokenExpiresAt.getTime() - bufferTime) {
                return this.accessToken;
            }
        }

        const accountId = this.configService.get<string>('ZOOM_ACCOUNT_ID');
        const clientId = this.configService.get<string>('ZOOM_CLIENT_ID');
        const clientSecret = this.configService.get<string>('ZOOM_CLIENT_SECRET');

        if (!accountId || !clientId || !clientSecret) {
            this.logger.error('Zoom credentials not configured');
            throw new BadRequestException('Zoom integration is not configured. Please contact administrator.');
        }

        try {
            const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

            const response = await fetch(this.zoomOAuthUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'account_credentials',
                    account_id: accountId,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`Failed to get Zoom access token: ${errorText}`);
                throw new InternalServerErrorException('Failed to authenticate with Zoom');
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiresAt = new Date(Date.now() + (data.expires_in * 1000));

            this.logger.log('Zoom access token obtained successfully');
            return this.accessToken as string;

        } catch (error) {
            this.logger.error(`Error getting Zoom access token: ${error.message}`);
            throw new InternalServerErrorException('Failed to connect to Zoom');
        }
    }

    /**
     * Create a Zoom meeting
     */
    async createMeeting(dto: CreateZoomMeetingDto): Promise<ZoomMeetingResponseDto> {
        const accessToken = await this.getAccessToken();

        const meetingData = {
            topic: dto.topic,
            type: 2, // Scheduled meeting
            start_time: dto.startTime,
            duration: dto.duration || 60,
            timezone: dto.timezone || 'Asia/Kolkata',
            agenda: dto.agenda || '',
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: true,
                mute_upon_entry: false,
                waiting_room: false,
                audio: 'both',
                auto_recording: 'none',
                approval_type: 2, // No registration required
                registration_type: 1,
                enforce_login: false,
            },
        };

        try {
            const response = await fetch(`${this.zoomApiBaseUrl}/users/me/meetings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(meetingData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                this.logger.error(`Failed to create Zoom meeting: ${JSON.stringify(errorData)}`);
                throw new InternalServerErrorException(`Failed to create Zoom meeting: ${errorData.message || 'Unknown error'}`);
            }

            const meeting = await response.json();

            this.logger.log(`Zoom meeting created successfully: ${meeting.id}`);

            return {
                meetingId: meeting.id.toString(),
                joinUrl: meeting.join_url,
                startUrl: meeting.start_url,
                password: meeting.password || '',
                hostEmail: meeting.host_email,
                hostId: meeting.host_id,
                topic: meeting.topic,
                duration: meeting.duration,
                timezone: meeting.timezone,
                startTime: meeting.start_time,
                createdAt: new Date(),
            };

        } catch (error) {
            if (error instanceof InternalServerErrorException || error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Error creating Zoom meeting: ${error.message}`);
            throw new InternalServerErrorException('Failed to create Zoom meeting');
        }
    }

    /**
     * Update an existing Zoom meeting
     */
    async updateMeeting(meetingId: string, dto: UpdateZoomMeetingDto): Promise<void> {
        const accessToken = await this.getAccessToken();

        const updateData: any = {};
        if (dto.topic) updateData.topic = dto.topic;
        if (dto.startTime) updateData.start_time = dto.startTime;
        if (dto.duration) updateData.duration = dto.duration;
        if (dto.agenda) updateData.agenda = dto.agenda;

        try {
            const response = await fetch(`${this.zoomApiBaseUrl}/meetings/${meetingId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                this.logger.error(`Failed to update Zoom meeting: ${JSON.stringify(errorData)}`);
                throw new InternalServerErrorException(`Failed to update Zoom meeting: ${errorData.message || 'Unknown error'}`);
            }

            this.logger.log(`Zoom meeting ${meetingId} updated successfully`);

        } catch (error) {
            if (error instanceof InternalServerErrorException) {
                throw error;
            }
            this.logger.error(`Error updating Zoom meeting: ${error.message}`);
            throw new InternalServerErrorException('Failed to update Zoom meeting');
        }
    }

    /**
     * Delete a Zoom meeting
     */
    async deleteMeeting(meetingId: string): Promise<void> {
        const accessToken = await this.getAccessToken();

        try {
            const response = await fetch(`${this.zoomApiBaseUrl}/meetings/${meetingId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            // 204 No Content is success for DELETE
            if (!response.ok && response.status !== 204) {
                const errorData = await response.json().catch(() => ({}));
                this.logger.error(`Failed to delete Zoom meeting: ${JSON.stringify(errorData)}`);
                // Don't throw error - meeting might already be deleted
                this.logger.warn(`Could not delete Zoom meeting ${meetingId}, it may have been already deleted`);
                return;
            }

            this.logger.log(`Zoom meeting ${meetingId} deleted successfully`);

        } catch (error) {
            // Don't throw error for delete failures - log and continue
            this.logger.warn(`Error deleting Zoom meeting ${meetingId}: ${error.message}`);
        }
    }

    /**
     * Get meeting details
     */
    async getMeeting(meetingId: string): Promise<any> {
        const accessToken = await this.getAccessToken();

        try {
            const response = await fetch(`${this.zoomApiBaseUrl}/meetings/${meetingId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                this.logger.error(`Failed to get Zoom meeting: ${JSON.stringify(errorData)}`);
                throw new InternalServerErrorException(`Failed to get Zoom meeting: ${errorData.message || 'Unknown error'}`);
            }

            return await response.json();

        } catch (error) {
            if (error instanceof InternalServerErrorException) {
                throw error;
            }
            this.logger.error(`Error getting Zoom meeting: ${error.message}`);
            throw new InternalServerErrorException('Failed to get Zoom meeting details');
        }
    }

    /**
     * Check if Zoom is configured
     */
    isConfigured(): boolean {
        const accountId = this.configService.get<string>('ZOOM_ACCOUNT_ID');
        const clientId = this.configService.get<string>('ZOOM_CLIENT_ID');
        const clientSecret = this.configService.get<string>('ZOOM_CLIENT_SECRET');
        return !!(accountId && clientId && clientSecret);
    }
}
