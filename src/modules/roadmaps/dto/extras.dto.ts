import { IsString, IsArray, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExtrasDto {
    @IsString()
    userId: string;

    @IsOptional()
    @IsString()
    nestedRoadMapItemId?: string;

    @IsOptional()
    @IsArray()
    @IsObject({ each: true })
    @Type(() => Object)
    extras?: Record<string, any>[];
}

export class UpdateExtrasDto {
    @IsOptional()
    @IsArray()
    @IsObject({ each: true })
    @Type(() => Object)
    extras?: Record<string, any>[];
}

export class ExtrasResponseDto {
    id: string;
    userId: string;
    roadMapId: string;
    nestedRoadMapItemId?: string;
    extras: Record<string, any>[];
    createdAt: Date;
    updatedAt: Date;
}
