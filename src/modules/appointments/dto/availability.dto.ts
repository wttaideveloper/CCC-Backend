import { IsArray, IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const SLOT_TIME_REGEX = /^(0?[1-9]|1[0-2]):00$/;

export class TimeSlotDto {
    @IsString()
    startTime!: string;

    @IsEnum(['AM', 'PM'])
    startPeriod!: 'AM' | 'PM';

    @IsString()
    endTime!: string;

    @IsEnum(['AM', 'PM'])
    endPeriod!: 'AM' | 'PM';
}

export class DayAvailabilityDto {
    // @IsNumber()
    // day: number;

    @IsString()
    date!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TimeSlotDto)
    slots!: TimeSlotDto[];
}

export class AvailabilityDto {
    @IsString()
    mentorId!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DayAvailabilityDto)
    weeklySlots!: DayAvailabilityDto[];

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

export class DeleteAvailabilitySlotDto {
    @IsMongoId({ message: 'slotId must be a valid Mongo ObjectId.' })
    slotId!: string;

    @IsOptional()
    @IsDateString()
    date?: string;
}
