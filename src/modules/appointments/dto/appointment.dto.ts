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

export class PersonInfoDto {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    profilePicture?: string;
    role?: string;
    roleId?: string;
    status?: string;
}

export class ZoomMeetingDto {
    meetingId?: string;
    joinUrl?: string;
    startUrl?: string;
    password?: string;
    hostEmail?: string;
    topic?: string;
    duration?: number;
}

export class AppointmentResponseDto {
    id: string;

    userId: string;
    mentorId: string;

    user: PersonInfoDto | null;
    mentor: PersonInfoDto | null;

    meetingDate: Date;
    endTime: Date;

    platform: string;
    meetingLink?: string;
    notes?: string;
    status: string;

    // Zoom meeting details
    zoomMeetingId?: string;
    zoomMeeting?: ZoomMeetingDto;

    createdAt?: Date;
    updatedAt?: Date;
}

export class CancelAppointmentDto {
    readonly reason?: string;
}