import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TimeSlotDto {
    @IsString()
    startTime: string;

    @IsEnum(['AM', 'PM'])
    startPeriod: 'AM' | 'PM';

    @IsString()
    endTime: string;

    @IsEnum(['AM', 'PM'])
    endPeriod: 'AM' | 'PM';
}

export class DayAvailabilityDto {
    @IsNumber()
    day: number;

    @IsString()
    date: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TimeSlotDto)
    slots: TimeSlotDto[];
}

export class AvailabilityDto {
    @IsString()
    mentorId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DayAvailabilityDto)
    weeklySlots: DayAvailabilityDto[];

    @IsOptional()
    @IsNumber()
    meetingDuration?: number;

    @IsOptional()
    @IsNumber()
    minSchedulingNoticeHours?: number;

    @IsOptional()
    @IsNumber()
    maxBookingsPerDay?: number;
}
