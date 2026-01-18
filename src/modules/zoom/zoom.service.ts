import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Appointment, AppointmentDocument } from '../appointments/schemas/appointment.schema';
import { EncryptionService } from '../../common/utils/encryption.util';
import { CreateZoomMeetingDto, UpdateZoomMeetingDto, ZoomWebhookPayload } from './dto/zoom-webhook.dto';
import * as crypto from 'crypto';

@Injectable()
export class ZoomService {
    private readonly logger = new Logger(ZoomService.name);
    private readonly zoomApiBaseUrl = 'https://api.zoom.us/v2';
    private readonly zoomAuthUrl = 'https://zoom.us/oauth';

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
        private readonly configService: ConfigService,
        private readonly encryptionService: EncryptionService,
    ) {}

    /**
     * Generate Zoom OAuth authorization URL
     */
    generateOAuthUrl(userId: string, state?: string): string {
        const params = new URLSearchParams({
            client_id: this.configService.get('ZOOM_CLIENT_ID') || '',
            response_type: 'code',
            redirect_uri: this.configService.get('ZOOM_REDIRECT_URI') || '',
            state: state || userId,
        });
        return `${this.zoomAuthUrl}/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string): Promise<any> {
        const clientId = this.configService.get('ZOOM_CLIENT_ID');
        const clientSecret = this.configService.get('ZOOM_CLIENT_SECRET');
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response = await fetch(`${this.zoomAuthUrl}/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.configService.get('ZOOM_REDIRECT_URI') || '',
            } as Record<string, string>),
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to exchange Zoom code for token:', error);
            throw new BadRequestException('Failed to authenticate with Zoom');
        }

        return response.json();
    }

    /**
     * Refresh expired access token
     */
    async refreshAccessToken(refreshToken: string): Promise<any> {
        const clientId = this.configService.get('ZOOM_CLIENT_ID');
        const clientSecret = this.configService.get('ZOOM_CLIENT_SECRET');
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response = await fetch(`${this.zoomAuthUrl}/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to refresh Zoom token:', error);
            throw new BadRequestException('Failed to refresh Zoom token');
        }

        return response.json();
    }

    /**
     * Get valid access token, refreshing if necessary
     */
    async getValidAccessToken(user: UserDocument): Promise<string> {
        if (!user.zoomConfig?.accessToken) {
            throw new BadRequestException('User has not connected Zoom account');
        }

        // Decrypt token
        const decryptedToken = this.encryptionService.decrypt(user.zoomConfig.accessToken);

        // Check if token is expired or expiring soon (within 5 minutes)
        const expiresAt = user.zoomConfig.tokenExpiresAt;
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        if (expiresAt && new Date(expiresAt) <= fiveMinutesFromNow) {
            this.logger.log(`Refreshing expired Zoom token for user ${user._id}`);

            const decryptedRefreshToken = this.encryptionService.decrypt(user.zoomConfig.refreshToken);
            const tokenData = await this.refreshAccessToken(decryptedRefreshToken);

            // Update user with new tokens
            await this.updateUserZoomTokens(user._id.toString(), tokenData);

            return tokenData.access_token;
        }

        return decryptedToken;
    }

    /**
     * Update user's Zoom tokens
     */
    private async updateUserZoomTokens(userId: string, tokenData: any): Promise<void> {
        const encryptedAccessToken = this.encryptionService.encrypt(tokenData.access_token);
        const encryptedRefreshToken = this.encryptionService.encrypt(tokenData.refresh_token);

        await this.userModel.findByIdAndUpdate(userId, {
            'zoomConfig.accessToken': encryptedAccessToken,
            'zoomConfig.refreshToken': encryptedRefreshToken,
            'zoomConfig.tokenExpiresAt': new Date(Date.now() + tokenData.expires_in * 1000),
            'zoomConfig.lastSyncedAt': new Date(),
        });
    }

    /**
     * Connect Zoom account for a user
     */
    async connectZoomAccount(userId: string, code: string): Promise<UserDocument> {
        const tokenData = await this.exchangeCodeForToken(code);

        // Get user info from Zoom
        const userInfo = await this.getZoomUserInfo(tokenData.access_token);

        // Encrypt tokens before storing
        const encryptedAccessToken = this.encryptionService.encrypt(tokenData.access_token);
        const encryptedRefreshToken = this.encryptionService.encrypt(tokenData.refresh_token);

        const user = await this.userModel.findByIdAndUpdate(
            userId,
            {
                zoomConfig: {
                    accountId: userInfo.account_id,
                    email: userInfo.email,
                    accessToken: encryptedAccessToken,
                    refreshToken: encryptedRefreshToken,
                    tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
                    tokenType: tokenData.token_type,
                    scope: tokenData.scope,
                    connectedAt: new Date(),
                    lastSyncedAt: new Date(),
                    settings: {
                        autoCreateMeetings: true,
                        defaultDuration: 60,
                        enableWaitingRoom: true,
                        enableJoinBeforeHost: true,
                        muteUponEntry: false,
                        autoRecording: 'none',
                        hostVideo: true,
                        participantVideo: true,
                    },
                },
            },
            { new: true }
        );

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    /**
     * Get Zoom user information
     */
    async getZoomUserInfo(accessToken: string): Promise<any> {
        const response = await fetch(`${this.zoomApiBaseUrl}/users/me`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to get Zoom user info:', error);
            throw new BadRequestException('Failed to get Zoom user info');
        }

        return response.json();
    }

    /**
     * Create Zoom meeting
     */
    async createMeeting(
        user: UserDocument,
        meetingData: CreateZoomMeetingDto
    ): Promise<any> {
        const accessToken = await this.getValidAccessToken(user);

        const defaultSettings: any = user.zoomConfig?.settings || {};

        const requestBody = {
            topic: meetingData.topic,
            type: meetingData.type || 2, // 2 = scheduled meeting
            start_time: meetingData.start_time,
            duration: meetingData.duration || defaultSettings.defaultDuration || 60,
            timezone: meetingData.timezone || 'Asia/Kolkata',
            agenda: meetingData.agenda || '',
            settings: {
                host_video: meetingData.settings?.host_video ?? defaultSettings.hostVideo ?? true,
                participant_video: meetingData.settings?.participant_video ?? defaultSettings.participantVideo ?? true,
                join_before_host: meetingData.settings?.join_before_host ?? defaultSettings.enableJoinBeforeHost ?? true,
                mute_upon_entry: meetingData.settings?.mute_upon_entry ?? defaultSettings.muteUponEntry ?? false,
                waiting_room: meetingData.settings?.waiting_room ?? defaultSettings.enableWaitingRoom ?? true,
                auto_recording: meetingData.settings?.auto_recording || defaultSettings.autoRecording || 'none',
                approval_type: meetingData.settings?.approval_type ?? 0,
            },
        };

        const response = await fetch(`${this.zoomApiBaseUrl}/users/me/meetings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to create Zoom meeting:', error);
            throw new BadRequestException('Failed to create Zoom meeting');
        }

        const meeting = await response.json();
        this.logger.log(`Created Zoom meeting: ${meeting.id} for user ${user._id}`);

        return meeting;
    }

    /**
     * Update Zoom meeting
     */
    async updateMeeting(
        user: UserDocument,
        meetingId: string,
        updateData: UpdateZoomMeetingDto
    ): Promise<any> {
        const accessToken = await this.getValidAccessToken(user);

        const response = await fetch(`${this.zoomApiBaseUrl}/meetings/${meetingId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to update Zoom meeting:', error);
            throw new BadRequestException('Failed to update Zoom meeting');
        }

        this.logger.log(`Updated Zoom meeting: ${meetingId}`);
        return response.status === 204 ? { success: true } : response.json();
    }

    /**
     * Delete Zoom meeting
     */
    async deleteMeeting(user: UserDocument, meetingId: string): Promise<void> {
        const accessToken = await this.getValidAccessToken(user);

        const response = await fetch(`${this.zoomApiBaseUrl}/meetings/${meetingId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok && response.status !== 404) {
            const error = await response.text();
            this.logger.error('Failed to delete Zoom meeting:', error);
            throw new BadRequestException('Failed to delete Zoom meeting');
        }

        this.logger.log(`Deleted Zoom meeting: ${meetingId}`);
    }

    /**
     * Get meeting details
     */
    async getMeeting(user: UserDocument, meetingId: string): Promise<any> {
        const accessToken = await this.getValidAccessToken(user);

        const response = await fetch(`${this.zoomApiBaseUrl}/meetings/${meetingId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to get Zoom meeting:', error);
            throw new NotFoundException('Zoom meeting not found');
        }

        return response.json();
    }

    /**
     * Verify Zoom webhook signature
     */
    verifyWebhookSignature(
        signature: string,
        timestamp: string,
        body: string
    ): boolean {
        try {
            const message = `v0:${timestamp}:${body}`;
            const secret = this.configService.get('ZOOM_WEBHOOK_SECRET');

            if (!secret) {
                this.logger.warn('ZOOM_WEBHOOK_SECRET not configured');
                return false;
            }

            const hash = crypto
                .createHmac('sha256', secret)
                .update(message)
                .digest('hex');

            const expectedSignature = `v0=${hash}`;
            return crypto.timingSafeEqual(
                Buffer.from(expectedSignature),
                Buffer.from(signature)
            );
        } catch (error) {
            this.logger.error('Error verifying Zoom webhook signature:', error);
            return false;
        }
    }

    /**
     * Handle Zoom webhook events
     */
    async handleWebhook(webhookData: ZoomWebhookPayload): Promise<any> {
        const { event, payload } = webhookData;

        this.logger.log(`Received Zoom webhook event: ${event}`);

        try {
            switch (event) {
                case 'meeting.created':
                    return await this.handleMeetingCreated(payload);
                case 'meeting.updated':
                    return await this.handleMeetingUpdated(payload);
                case 'meeting.deleted':
                    return await this.handleMeetingDeleted(payload);
                case 'meeting.started':
                    return await this.handleMeetingStarted(payload);
                case 'meeting.ended':
                    return await this.handleMeetingEnded(payload);
                case 'meeting.participant_joined':
                    return await this.handleParticipantJoined(payload);
                default:
                    this.logger.warn(`Unhandled Zoom webhook event: ${event}`);
                    return { message: `Event ${event} received but not processed` };
            }
        } catch (error) {
            this.logger.error(`Error processing Zoom webhook event ${event}:`, error);
            throw error;
        }
    }

    private async handleMeetingCreated(payload: any): Promise<any> {
        this.logger.log(`Meeting created: ${payload.object.id}`);
        return { status: 'meeting_created_logged' };
    }

    private async handleMeetingUpdated(payload: any): Promise<any> {
        this.logger.log(`Meeting updated: ${payload.object.id}`);

        // Update appointment if exists
        const appointment = await this.appointmentModel.findOne({
            zoomMeetingId: payload.object.id.toString(),
        });

        if (appointment) {
            await this.appointmentModel.findByIdAndUpdate(appointment._id, {
                'zoomMetadata.joinUrl': payload.object.join_url,
            });
        }

        return { status: 'meeting_updated' };
    }

    private async handleMeetingDeleted(payload: any): Promise<any> {
        this.logger.log(`Meeting deleted: ${payload.object.id}`);

        // Update appointment if exists
        const appointment = await this.appointmentModel.findOne({
            zoomMeetingId: payload.object.id.toString(),
        });

        if (appointment && appointment.status === 'scheduled') {
            await this.appointmentModel.findByIdAndUpdate(appointment._id, {
                status: 'canceled',
                cancelReason: 'Zoom meeting was deleted',
                canceledAt: new Date(),
            });
        }

        return { status: 'meeting_deleted_processed' };
    }

    private async handleMeetingStarted(payload: any): Promise<any> {
        this.logger.log(`Meeting started: ${payload.object.id}`);
        return { status: 'meeting_started_logged' };
    }

    private async handleMeetingEnded(payload: any): Promise<any> {
        this.logger.log(`Meeting ended: ${payload.object.id}`);

        // Mark appointment as completed
        const appointment = await this.appointmentModel.findOne({
            zoomMeetingId: payload.object.id.toString(),
        });

        if (appointment && appointment.status === 'scheduled') {
            await this.appointmentModel.findByIdAndUpdate(appointment._id, {
                status: 'completed',
            });
        }

        return { status: 'meeting_ended_processed' };
    }

    private async handleParticipantJoined(payload: any): Promise<any> {
        this.logger.log(`Participant joined meeting: ${payload.object.id}`);
        return { status: 'participant_joined_logged' };
    }

    /**
     * Update user's Zoom settings
     */
    async updateZoomSettings(
        userId: string,
        settings: any
    ): Promise<UserDocument> {
        const user = await this.userModel.findByIdAndUpdate(
            userId,
            {
                $set: {
                    'zoomConfig.settings': settings,
                    'zoomConfig.lastSyncedAt': new Date(),
                },
            },
            { new: true }
        );

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    /**
     * Disconnect Zoom account
     */
    async disconnectZoomAccount(userId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            $unset: { zoomConfig: 1 },
        });

        this.logger.log(`Disconnected Zoom account for user ${userId}`);
    }
}
