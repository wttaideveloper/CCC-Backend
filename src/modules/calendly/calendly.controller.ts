import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    Headers,
    BadRequestException,
    UnauthorizedException,
    Query,
    Patch,
} from '@nestjs/common';
import { CalendlyService } from './calendly.service';
import { CalendlyWebhookDto, UpdateCalendlyConfigDto } from './dto/calendly-webhook.dto';
import { BaseResponse } from '../../shared/interfaces/base-response.interface';
import { ConfigService } from '@nestjs/config';

@Controller('calendly')
export class CalendlyController {
    constructor(
        private readonly calendlyService: CalendlyService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * Webhook endpoint to receive Calendly events
     * POST /calendly/webhook
     */
    @Post('webhook')
    async handleWebhook(
        @Headers('calendly-webhook-signature') signature: string,
        @Body() webhookData: any,
    ): Promise<BaseResponse<any>> {
        // Verify webhook signature
        const webhookSecret = this.configService.get<string>('CALENDLY_WEBHOOK_SECRET');

        if (webhookSecret && signature) {
            const isValid = this.calendlyService.verifyWebhookSignature(
                signature,
                JSON.stringify(webhookData),
                webhookSecret
            );

            if (!isValid) {
                throw new UnauthorizedException('Invalid webhook signature');
            }
        }

        const result = await this.calendlyService.handleWebhook(webhookData);

        return {
            success: true,
            message: 'Webhook processed successfully',
            data: result,
        };
    }

    /**
     * Initiate OAuth connection
     * GET /calendly/oauth/connect/:userId
     */
    @Get('oauth/connect/:userId')
    async initiateOAuth(@Param('userId') userId: string): Promise<BaseResponse<{ oauthUrl: string }>> {
        const oauthUrl = this.calendlyService.generateOAuthUrl(userId);

        return {
            success: true,
            message: 'Redirect user to this URL to authorize Calendly',
            data: { oauthUrl },
        };
    }

    /**
     * OAuth callback handler
     * GET /calendly/oauth/callback?code=XXX&state=userId
     */
    @Get('oauth/callback')
    async handleOAuthCallback(
        @Query('code') code: string,
        @Query('state') userId: string,
    ): Promise<BaseResponse<any>> {
        if (!code || !userId) {
            throw new BadRequestException('Missing code or user ID');
        }

        const user = await this.calendlyService.connectCalendlyAccount(userId, code);

        return {
            success: true,
            message: 'Calendly account connected successfully',
            data: {
                userId: user._id,
                username: user.calendlyConfig?.calendlyUsername,
                eventTypesCount: user.calendlyConfig?.eventTypes?.length || 0,
                connectedAt: user.calendlyConfig?.connectedAt,
            },
        };
    }

    /**
     * Get mentor's Calendly booking link
     * GET /calendly/booking-link/:mentorId?targetRole=pastor
     */
    @Get('booking-link/:mentorId')
    async getBookingLink(
        @Param('mentorId') mentorId: string,
        @Query('targetRole') targetRole?: string,
    ): Promise<BaseResponse<{ bookingLink: string | null }>> {
        const bookingLink = await this.calendlyService.getMentorBookingLink(mentorId, targetRole);

        if (!bookingLink) {
            throw new BadRequestException(
                'Mentor does not have Calendly configured or no event type found for the specified role'
            );
        }

        return {
            success: true,
            message: 'Booking link retrieved successfully',
            data: { bookingLink },
        };
    }

    /**
     * Sync event types from Calendly
     * POST /calendly/sync-event-types/:userId
     */
    @Post('sync-event-types/:userId')
    async syncEventTypes(@Param('userId') userId: string): Promise<BaseResponse<any>> {
        const user = await this.calendlyService.syncEventTypes(userId);

        return {
            success: true,
            message: 'Event types synced successfully',
            data: {
                userId: user._id,
                eventTypes: user.calendlyConfig?.eventTypes,
                lastSyncedAt: user.calendlyConfig?.lastSyncedAt,
            },
        };
    }

    /**
     * Update event type role mapping
     * PATCH /calendly/event-type/:userId/:eventTypeUuid
     */
    @Patch('event-type/:userId/:eventTypeUuid')
    async updateEventTypeMapping(
        @Param('userId') userId: string,
        @Param('eventTypeUuid') eventTypeUuid: string,
        @Body() body: { targetRole: string; internalNote?: string },
    ): Promise<BaseResponse<any>> {
        const user = await this.calendlyService.updateEventTypeMapping(
            userId,
            eventTypeUuid,
            body.targetRole,
            body.internalNote
        );

        return {
            success: true,
            message: 'Event type mapping updated successfully',
            data: {
                userId: user._id,
                eventTypes: user.calendlyConfig?.eventTypes,
            },
        };
    }

    /**
     * Get all mentors with Calendly configured
     * GET /calendly/mentors?roles[]=mentor&roles[]=director
     */
    @Get('mentors')
    async getMentorsWithCalendly(@Query('roles') roles?: string[]): Promise<BaseResponse<any>> {
        const mentors = await this.calendlyService.getMentorsWithCalendly(roles);

        return {
            success: true,
            message: 'Mentors with Calendly retrieved successfully',
            data: { mentors, count: mentors.length },
        };
    }

    /**
     * Disconnect Calendly account
     * DELETE /calendly/disconnect/:userId
     */
    @Delete('disconnect/:userId')
    async disconnectCalendly(@Param('userId') userId: string): Promise<BaseResponse<void>> {
        await this.calendlyService.disconnectCalendlyAccount(userId);

        return {
            success: true,
            message: 'Calendly account disconnected successfully',
            data: undefined,
        };
    }

    /**
     * Update user's Calendly configuration (legacy endpoint)
     * PATCH /calendly/config/:userId
     */
    @Patch('config/:userId')
    async updateCalendlyConfig(
        @Param('userId') userId: string,
        @Body() config: UpdateCalendlyConfigDto,
    ): Promise<BaseResponse<any>> {
        const user = await this.calendlyService.updateCalendlyConfig(userId, config);

        return {
            success: true,
            message: 'Calendly configuration updated successfully',
            data: {
                userId: user._id,
                calendlyConfig: user.calendlyConfig,
            },
        };
    }

    /**
     * Get availability for all mentors, directors, and field mentors
     * GET /calendly/availability/all?roles[]=mentor&roles[]=director&targetRole=pastor
     */
    @Get('availability/all')
    async getAllMentorsAvailability(
        @Query('roles') roles?: string[],
        @Query('targetRole') targetRole?: string,
    ): Promise<BaseResponse<any>> {
        const mentorsAvailability = await this.calendlyService.getAllMentorsAvailability(roles, targetRole);

        return {
            success: true,
            message: 'Mentors availability fetched successfully',
            data: { mentors: mentorsAvailability, count: mentorsAvailability.length },
        };
    }

    /**
     * Get availability for a specific mentor from Calendly
     * GET /calendly/availability/:userId?eventTypeUuid=XXX&startDate=2024-01-01&endDate=2024-01-31
     */
    @Get('availability/:userId')
    async getUserAvailability(
        @Param('userId') userId: string,
        @Query('eventTypeUuid') eventTypeUuid?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ): Promise<BaseResponse<any>> {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        const availability = await this.calendlyService.getUserAvailability(
            userId,
            eventTypeUuid,
            start,
            end
        );

        return {
            success: true,
            message: 'Availability fetched successfully',
            data: { availability },
        };
    }

    /**
     * Get mentor's busy times (scheduled events) from Calendly
     * GET /calendly/busy-times/:userId?startDate=2024-01-01&endDate=2024-01-31
     */
    @Get('busy-times/:userId')
    async getMentorBusyTimes(
        @Param('userId') userId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ): Promise<BaseResponse<any>> {
        if (!startDate || !endDate) {
            throw new BadRequestException('startDate and endDate are required');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const busyTimes = await this.calendlyService.getMentorBusyTimes(userId, start, end);

        return {
            success: true,
            message: 'Busy times fetched successfully',
            data: { busyTimes, count: busyTimes.length },
        };
    }
}
