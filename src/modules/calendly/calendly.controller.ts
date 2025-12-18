import {
    Controller,
    Post,
    Get,
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
        const webhookSecret = this.configService.get<string>('calendlyWebhookSecret');

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
     * Get mentor's Calendly booking link
     * GET /calendly/booking-link/:mentorId
     */
    // @Get('booking-link/:mentorId')
    // async getBookingLink(
    //     @Param('mentorId') mentorId: string,
    //     @Query('targetRole') targetRole?: string,
    // ): Promise<BaseResponse<{ bookingLink: string | null }>> {
    //     const bookingLink = await this.calendlyService.getMentorBookingLink(mentorId, targetRole);

    //     if (!bookingLink) {
    //         throw new BadRequestException(
    //             'Mentor does not have Calendly configured or no event type found for the specified role'
    //         );
    //     }

    //     return {
    //         success: true,
    //         message: 'Booking link retrieved successfully',
    //         data: { bookingLink },
    //     };
    // }

    /**
     * Update user's Calendly configuration
     * PATCH /calendly/config/:userId
     */
    // @Patch('config/:userId')
    // async updateCalendlyConfig(
    //     @Param('userId') userId: string,
    //     @Body() config: UpdateCalendlyConfigDto,
    // ): Promise<BaseResponse<any>> {
    //     const user = await this.calendlyService.updateCalendlyConfig(userId, config);

    //     return {
    //         success: true,
    //         message: 'Calendly configuration updated successfully',
    //         data: {
    //             userId: user._id,
    //             calendlyConfig: user.calendlyConfig,
    //         },
    //     };
    // }
}
