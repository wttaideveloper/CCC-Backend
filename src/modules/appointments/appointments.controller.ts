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

    /**
     * UNIFIED AVAILABILITY ENDPOINT (RECOMMENDED FOR STUDENTS)
     * GET /appointments/availability/unified?targetRole=pastor&mentorRoles[]=mentor&startDate=2024-01-01&endDate=2024-01-31
     *
     * Returns combined availability from:
     * - Calendly (real-time) for mentors with Calendly configured
     * - Manual DB slots for mentors without Calendly
     *
     * Use this endpoint for students (pastors, seminarians, etc.) to see all available mentors
     */
    @Get('availability/unified')
    async getUnifiedAvailability(
        @Query('targetRole') targetRole?: string,
        @Query('mentorRoles') mentorRoles?: string[],
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ): Promise<BaseResponse<any>> {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        const data = await this.appointmentsService.getUnifiedAvailability(
            targetRole,
            mentorRoles,
            start,
            end
        );

        return {
            success: true,
            message: 'Unified availability fetched successfully',
            data: {
                mentors: data,
                count: data.length,
                calendlyEnabled: data.filter(m => m.source === 'calendly').length,
                manualAvailability: data.filter(m => m.source === 'manual').length,
            },
        };
    }
}