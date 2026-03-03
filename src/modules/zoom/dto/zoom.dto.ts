import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreateZoomMeetingDto {
    @IsString()
    topic: string;

    @IsDateString()
    startTime: string;

    @IsNumber()
    @IsOptional()
    duration?: number;

    @IsString()
    @IsOptional()
    timezone?: string;

    @IsString()
    @IsOptional()
    agenda?: string;

    @IsString()
    @IsOptional()
    hostUserId?: string;
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
