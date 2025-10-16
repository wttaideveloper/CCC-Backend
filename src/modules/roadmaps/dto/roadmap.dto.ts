import { IsString, IsOptional, IsDateString, IsBoolean, IsEnum, IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class NestedRoadMapItemDto {

    @IsOptional()
    @IsString()
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
    extras?: Object;
}

export class CreateRoadMapDto {
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
    extras?: Object;

    @IsOptional()
    @IsString()
    phase?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => NestedRoadMapItemDto)
    roadmaps?: NestedRoadMapItemDto[];
}

export class RoadMapResponseDto {
    _id: string;
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
    extras?: Object;
    haveNextedRoadMaps: boolean;
    phase?: string;
    roadmaps: NestedRoadMapItemDto[];
    // createdAt: Date;
    // updatedAt: Date;
}