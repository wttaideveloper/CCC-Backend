import { Controller, Post, Body, Get, Param, Patch, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, AppointmentResponseDto, UpdateAppointmentDto, CancelAppointmentDto } from './dto/appointment.dto';
import { BaseResponse } from 'src/shared/interfaces/base-response.interface';
import { AvailabilityDto } from './dto/availability.dto';

@Controller('appointments')
export class AppointmentsController {
    constructor(private readonly appointmentsService: AppointmentsService) { }

    @Post()
    async create(@Body() dto: CreateAppointmentDto): Promise<BaseResponse<AppointmentResponseDto>> {
        const data = await this.appointmentsService.create(dto);
        return {
            success: true,
            message: 'Appointment scheduled successfully.',
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

    @Get('mentor/:mentorId')
    async getMentorSchedule(
        @Param('mentorId') mentorId: string,
        @Query('futureOnly') futureOnly: string = 'true'
    ): Promise<BaseResponse<AppointmentResponseDto[]>> {
        const data = await this.appointmentsService.getSchedule(
            mentorId,
            'mentor',
            futureOnly === 'true'
        );
        return {
            success: true,
            message: `Schedule fetched for mentor ${mentorId}.`,
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
}