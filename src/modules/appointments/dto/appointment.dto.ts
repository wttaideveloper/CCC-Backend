import { IsDateString, IsEnum, IsMongoId, IsOptional, IsString, IsNotEmpty } from 'class-validator';

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

    @IsEnum(['gmeet', 'zoom', 'teams', 'phone', 'in-person', 'other'])
    platform: string;

    @IsOptional()
    @IsString()
    meetingLink?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateAppointmentDto {
    @IsOptional()
    @IsDateString()
    meetingDate?: string;

    @IsOptional()
    @IsEnum(['gmeet', 'zoom', 'teams', 'phone', 'in-person', 'other'])
    platform?: string;

    @IsOptional()
    @IsEnum(['scheduled', 'completed', 'postponed', 'canceled'])
    status?: string;

    @IsOptional()
    @IsString()
    meetingLink?: string;
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
}