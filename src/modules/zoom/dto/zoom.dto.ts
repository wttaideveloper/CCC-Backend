import { IsString, IsNumber, IsOptional, IsDateString, IsEnum } from 'class-validator';

export class CreateZoomMeetingDto {
    @IsString()
    topic: string;

    @IsDateString()
    startTime: string;

    @IsNumber()
    @IsOptional()
    duration?: number; // in minutes, default 60

    @IsString()
    @IsOptional()
    timezone?: string; // default 'Asia/Kolkata'

    @IsString()
    @IsOptional()
    agenda?: string;
}

export class ZoomMeetingResponseDto {
    meetingId: string;
    joinUrl: string;
    startUrl: string;
    password: string;
    hostEmail: string;
    hostId: string;
    topic: string;
    duration: number;
    timezone: string;
    startTime: string;
    createdAt: Date;
}

export class UpdateZoomMeetingDto {
    @IsString()
    @IsOptional()
    topic?: string;

    @IsDateString()
    @IsOptional()
    startTime?: string;

    @IsNumber()
    @IsOptional()
    duration?: number;

    @IsString()
    @IsOptional()
    agenda?: string;
}
