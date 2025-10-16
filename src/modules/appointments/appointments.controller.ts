import { Controller, Post, Body, Get, Param, Patch, Query, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, AppointmentResponseDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { BaseResponse } from 'src/shared/interfaces/base-response.interface';

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
}