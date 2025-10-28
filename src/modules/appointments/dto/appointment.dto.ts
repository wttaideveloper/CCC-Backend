import { IsDateString, IsEnum, IsMongoId, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { VALID_APPOINTMENT_PLATFORMS, VALID_APPOINTMENT_STATUSES } from '../../../common/constants/status.constants';

export class CreateAppointmentDto {
    @IsMongoId()
    @IsNotEmpty()
    userId: string;

    @IsMongoId()
    @IsNotEmpty()
    mentorId: string;

    @IsDateString()
    @IsNotEmpty()
    meetingDate: string;

    @IsEnum(VALID_APPOINTMENT_PLATFORMS)
    platform: string;

    @IsOptional()
    @IsString()
    meetingLink?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateAppointmentDto extends PartialType(
    OmitType(CreateAppointmentDto, ['userId', 'mentorId'] as const)
) {
    @IsOptional()
    @IsEnum(VALID_APPOINTMENT_STATUSES)
    status?: string;
}

export class AppointmentResponseDto {
    id: string;
    userId: string;
    mentorId: string;
    meetingDate: Date;
    endTime: Date;
    platform: string;
    meetingLink?: string;
    status: string;
    notes?: string;
}