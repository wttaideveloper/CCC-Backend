import {
    Controller,
    Post,
    Get,
    Delete,
    Patch,
    Body,
    Param,
    Query,
    Headers,
    BadRequestException,
    UnauthorizedException,
} from '@nestjs/common';
import { ZoomService } from './zoom.service';
import {
    ZoomWebhookDto,
    CreateZoomMeetingDto,
    UpdateZoomMeetingDto,
    ZoomUserSettingsDto,
} from './dto/zoom-webhook.dto';
import { BaseResponse } from '../../shared/interfaces/base-response.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';

@Controller('zoom')
export class ZoomController {
    constructor(
        private readonly zoomService: ZoomService,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) {}

    /**
     * Initiate OAuth connection
     * GET /zoom/oauth/connect/:userId
     */
    @Get('oauth/connect/:userId')
    async initiateOAuth(@Param('userId') userId: string): Promise<BaseResponse<{ oauthUrl: string }>> {
        const oauthUrl = this.zoomService.generateOAuthUrl(userId);

        return {
            success: true,
            message: 'Redirect user to this URL to authorize Zoom',
            data: { oauthUrl },
        };
    }

    /**
     * OAuth callback handler
     * GET /zoom/oauth/callback?code=XXX&state=userId
     */
    @Get('oauth/callback')
    async handleOAuthCallback(
        @Query('code') code: string,
        @Query('state') userId: string,
    ): Promise<BaseResponse<any>> {
        if (!code || !userId) {
            throw new BadRequestException('Missing code or user ID');
        }

        const user = await this.zoomService.connectZoomAccount(userId, code);

        return {
            success: true,
            message: 'Zoom account connected successfully',
            data: {
                userId: user._id,
                email: user.zoomConfig?.email,
                connectedAt: user.zoomConfig?.connectedAt,
            },
        };
    }

    /**
     * Disconnect Zoom account
     * DELETE /zoom/disconnect/:userId
     */
    @Delete('disconnect/:userId')
    async disconnectZoom(@Param('userId') userId: string): Promise<BaseResponse<void>> {
        await this.zoomService.disconnectZoomAccount(userId);

        return {
            success: true,
            message: 'Zoom account disconnected successfully',
            data: undefined,
        };
    }

    /**
     * Create Zoom meeting
     * POST /zoom/meetings/:userId
     */
    @Post('meetings/:userId')
    async createMeeting(
        @Param('userId') userId: string,
        @Body() createDto: CreateZoomMeetingDto,
    ): Promise<BaseResponse<any>> {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new BadRequestException('User not found');
        }

        if (!user.zoomConfig?.accessToken) {
            throw new BadRequestException('User has not connected Zoom account');
        }

        const meeting = await this.zoomService.createMeeting(user, createDto);

        return {
            success: true,
            message: 'Zoom meeting created successfully',
            data: meeting,
        };
    }

    /**
     * Update Zoom meeting
     * PATCH /zoom/meetings/:userId/:meetingId
     */
    @Patch('meetings/:userId/:meetingId')
    async updateMeeting(
        @Param('userId') userId: string,
        @Param('meetingId') meetingId: string,
        @Body() updateDto: UpdateZoomMeetingDto,
    ): Promise<BaseResponse<any>> {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new BadRequestException('User not found');
        }

        const result = await this.zoomService.updateMeeting(user, meetingId, updateDto);

        return {
            success: true,
            message: 'Zoom meeting updated successfully',
            data: result,
        };
    }

    /**
     * Delete Zoom meeting
     * DELETE /zoom/meetings/:userId/:meetingId
     */
    @Delete('meetings/:userId/:meetingId')
    async deleteMeeting(
        @Param('userId') userId: string,
        @Param('meetingId') meetingId: string,
    ): Promise<BaseResponse<void>> {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new BadRequestException('User not found');
        }

        await this.zoomService.deleteMeeting(user, meetingId);

        return {
            success: true,
            message: 'Zoom meeting deleted successfully',
            data: undefined,
        };
    }

    /**
     * Get Zoom meeting details
     * GET /zoom/meetings/:userId/:meetingId
     */
    @Get('meetings/:userId/:meetingId')
    async getMeeting(
        @Param('userId') userId: string,
        @Param('meetingId') meetingId: string,
    ): Promise<BaseResponse<any>> {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new BadRequestException('User not found');
        }

        const meeting = await this.zoomService.getMeeting(user, meetingId);

        return {
            success: true,
            message: 'Zoom meeting retrieved successfully',
            data: meeting,
        };
    }

    /**
     * Update Zoom settings for user
     * PATCH /zoom/settings/:userId
     */
    @Patch('settings/:userId')
    async updateSettings(
        @Param('userId') userId: string,
        @Body() settings: ZoomUserSettingsDto,
    ): Promise<BaseResponse<any>> {
        const user = await this.zoomService.updateZoomSettings(userId, settings);

        return {
            success: true,
            message: 'Zoom settings updated successfully',
            data: {
                userId: user._id,
                settings: user.zoomConfig?.settings,
            },
        };
    }

    /**
     * Get Zoom settings for user
     * GET /zoom/settings/:userId
     */
    @Get('settings/:userId')
    async getSettings(@Param('userId') userId: string): Promise<BaseResponse<any>> {
        const user = await this.userModel.findById(userId).select('zoomConfig');
        if (!user) {
            throw new BadRequestException('User not found');
        }

        return {
            success: true,
            message: 'Zoom settings retrieved successfully',
            data: {
                connected: !!user.zoomConfig?.accessToken,
                email: user.zoomConfig?.email,
                settings: user.zoomConfig?.settings,
                connectedAt: user.zoomConfig?.connectedAt,
            },
        };
    }

    /**
     * Webhook endpoint to receive Zoom events
     * POST /zoom/webhook
     */
    @Post('webhook')
    async handleWebhook(
        @Headers('x-zm-signature') signature: string,
        @Headers('x-zm-request-timestamp') timestamp: string,
        @Body() webhookData: any,
    ): Promise<BaseResponse<any>> {
        // Zoom webhook verification challenge
        if (webhookData.event === 'endpoint.url_validation') {
            return {
                success: true,
                message: 'Endpoint validated',
                data: {
                    plainToken: webhookData.payload.plainToken,
                    encryptedToken: this.hashToken(webhookData.payload.plainToken),
                },
            };
        }

        // Verify webhook signature
        if (signature && timestamp) {
            const isValid = this.zoomService.verifyWebhookSignature(
                signature,
                timestamp,
                JSON.stringify(webhookData)
            );

            if (!isValid) {
                throw new UnauthorizedException('Invalid webhook signature');
            }
        }

        const result = await this.zoomService.handleWebhook(webhookData);

        return {
            success: true,
            message: 'Zoom webhook processed successfully',
            data: result,
        };
    }

    /**
     * Hash token for Zoom webhook validation
     */
    private hashToken(plainToken: string): string {
        const crypto = require('crypto');
        return crypto
            .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET || '')
            .update(plainToken)
            .digest('hex');
    }
}
