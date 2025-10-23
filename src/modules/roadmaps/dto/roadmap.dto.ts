import { IsString, IsOptional, IsDateString, IsBoolean, IsEnum, IsArray, ArrayMinSize, ValidateNested, IsNumber, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class NestedRoadMapItemDto {

    @IsOptional()
    @IsMongoId()
    readonly _id?: string;

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    roadMapDetails?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(['due', 'not started', 'completed'])
    @IsOptional()
    status?: 'due' | 'not started' | 'completed';

    @IsString()
    duration: string;

    @IsOptional()
    @IsDateString()
    startDate?: Date;

    @IsOptional()
    @IsDateString()
    endDate?: Date;

    @IsOptional()
    @IsDateString()
    completedOn?: Date;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsArray()
    @IsDateString({}, { each: true })
    meetings?: Date[];

    @IsOptional()
    @IsString()
    phase?: string;

    @IsOptional()
    @IsNumber()
    totalSteps?: number;

    @IsOptional()
    extras?: Record<string, any>;
}

export class CreateRoadMapDto {
    @IsString()
    type: string;

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    roadMapDetails?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(['due', 'not started', 'completed'])
    @IsOptional()
    status?: 'due' | 'not started' | 'completed';

    @IsString()
    duration: string;

    @IsOptional()
    @IsDateString()
    startDate?: Date;

    @IsOptional()
    @IsDateString()
    endDate?: Date;

    @IsOptional()
    @IsDateString()
    completedOn?: Date;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsArray()
    @IsDateString({}, { each: true })
    meetings?: Date[];

    @IsOptional()
    extras?: Record<string, any>;

    @IsOptional()
    @IsString()
    division: string;

    @IsOptional()
    @IsString()
    phase?: string;

    @IsOptional()
    @IsMongoId()
    assesmentId?: string;

    @IsOptional()
    @IsNumber()
    totalSteps?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => NestedRoadMapItemDto)
    roadmaps?: NestedRoadMapItemDto[];
}

export class UpdateRoadMapDto extends PartialType(CreateRoadMapDto) { }

export class RoadMapResponseDto {
    _id: string;
    type: string;
    name: string;
    roadMapDetails?: string;
    description?: string;
    status: string;
    duration?: string;
    startDate?: Date;
    endDate?: Date;
    completedOn?: Date;
    imageUrl?: string;
    meetings?: Date[];
    extras?: Record<string, any>;
    division: string;
    haveNextedRoadMaps: boolean;
    phase?: string;
    assesmentId?: string;
    totalSteps?: number;
    roadmaps: NestedRoadMapItemDto[];
    // createdAt: Date;
    // updatedAt: Date;
}