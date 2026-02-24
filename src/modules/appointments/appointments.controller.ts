import { Controller, Post, Body, Get, Param, Patch, Query, HttpCode, Headers, Logger, Req } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, AppointmentResponseDto, UpdateAppointmentDto, CancelAppointmentDto } from './dto/appointment.dto';
import { BaseResponse } from 'src/shared/interfaces/base-response.interface';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AvailabilityDto } from './dto/availability.dto';

@Controller('appointments')
export class AppointmentsController {
    private readonly logger = new Logger(AppointmentsController.name);

    constructor(
        private readonly appointmentsService: AppointmentsService,
        private readonly configService: ConfigService,
    ) { }

    @Post()
    async create(@Body() dto: CreateAppointmentDto): Promise<BaseResponse<AppointmentResponseDto>> {
        const data = await this.appointmentsService.create(dto);
        return {
            success: true,
            message: 'Appointment scheduled successfully.',
            data,
        };
    }

    @Get('upcoming')
    async getAllUpcomingAppointments(
        @Query('userId') userId?: string,
        @Query('mentorId') mentorId?: string,
        @Query('status') status?: string,
        @Query('futureOnly') futureOnly?: string,
    ): Promise<BaseResponse<AppointmentResponseDto[]>> {
        const data = await this.appointmentsService.getAppointments({
            userId,
            mentorId,
            status: status || 'scheduled',
            futureOnly: futureOnly !== 'false',
        });
        return {
            success: true,
            message: 'Appointments fetched successfully.',
            data,
        };
    }

    @Get('user/:userId')
    async getUserSchedule(
        @Param('userId') userId: string,
        @Query('futureOnly') futureOnly: string = 'true'
    ): Promise<BaseResponse<AppointmentResponseDto[]>> {
        const data = await this.appointmentsService.getSchedule(
            userId,
            'user',
            futureOnly === 'true'
        );
        return {
            success: true,
            message: `Schedule fetched for user ${userId}.`,
            data,
        };
    }

    @Get('mentor/:userId')
    async getMentorSchedule(
        @Param('userId') userId: string,
        @Query('futureOnly') futureOnly: string = 'true'
    ): Promise<BaseResponse<AppointmentResponseDto[]>> {
        const data = await this.appointmentsService.getSchedule(
            userId,
            'mentor',
            futureOnly === 'true'
        );
        return {
            success: true,
            message: `Schedule fetched for mentor ${userId}.`,
            data,
        };
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateAppointmentDto
    ): Promise<BaseResponse<AppointmentResponseDto>> {
        const data = await this.appointmentsService.update(id, dto);
        return {
            success: true,
            message: 'Appointment updated successfully.',
            data,
        };
    }

    @Post('availability')
    async upsertAvailability(
        @Body() dto: AvailabilityDto
    ): Promise<BaseResponse<any>> {
        const data = await this.appointmentsService.upsertAvailability(dto);
        return {
            success: true,
            message: "Weekly availability updated.",
            data
        };
    }

    @Get('availability/:mentorId')
    async getMentorAvailability(@Param('mentorId') mentorId: string) {
        const data = await this.appointmentsService.getMentorAvailability(mentorId);
        return {
            success: true,
            message: "Weekly availability fetched.",
            data
        };
    }

    @Get('availability/:mentorId/month')
    async getMonthly(
        @Param('mentorId') mentorId: string,
        @Query('year') year: string,
        @Query('month') month: string
    ) {
        const y = Number(year);
        const m = Number(month) - 1;

        const data = await this.appointmentsService.getMonthlyAvailability(mentorId, y, m);

        return {
            success: true,
            message: "Monthly availability generated.",
            data
        };
    }

    @Patch(':id/reschedule')
    async reschedule(
        @Param('id') id: string,
        @Body() dto: { newDate: string, startTime: string, startPeriod: 'AM' | 'PM' }
    ) {
        const data = await this.appointmentsService.reschedule(id, dto);
        return { success: true, message: 'Appointment rescheduled', data };
    }

    @Patch(':id/cancel')
    async cancel(
        @Param('id') id: string,
        @Body() body: CancelAppointmentDto
    ) {
        const result = await this.appointmentsService.cancel(id, { reason: body.reason });
        return { success: true, data: result };
    }

    @Post('zoom-webhook')
    @HttpCode(200)
    async zoomWebhook(
        @Req() req: any,
        @Body() body: any,
        @Headers('x-zm-request-timestamp') timestamp: string,
        @Headers('x-zm-signature') signature: string,
    ) {
        if (body?.event === 'endpoint.url_validation') {
            const plainToken = body?.payload?.plainToken;
            const secret = this.configService.get<string>('ZOOM_WEBHOOK_SECRET_TOKEN') ?? '';
            const encryptedToken = createHmac('sha256', secret)
                .update(plainToken)
                .digest('hex');
            return { plainToken, encryptedToken };
        }

        const secret = this.configService.get<string>('ZOOM_WEBHOOK_SECRET_TOKEN');
        if (secret) {
            const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(body);
            const message = `v0:${timestamp}:${rawBody}`;
            const expected = 'v0=' + createHmac('sha256', secret).update(message).digest('hex');
            if (signature !== expected) {
                this.logger.warn('Zoom webhook: invalid signature — request ignored');
                return { success: false, message: 'Invalid signature' };
            }
        }

        await this.appointmentsService.handleZoomWebhook(body);
        return { success: true };
    }
}