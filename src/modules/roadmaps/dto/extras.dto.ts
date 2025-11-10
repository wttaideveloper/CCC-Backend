import { IsString, IsArray, IsOptional } from 'class-validator';

export class CreateExtrasDto {
    @IsString()
    userId: string;

    @IsString()
    roadMapId: string;

    @IsOptional()
    @IsString()
    nestedRoadMapItemId?: string;

    @IsOptional()
    @IsArray()
    extras?: any[];
}

export class UpdateExtrasDto {
    @IsOptional()
    @IsArray()
    extras?: any[];
}

export class ExtrasResponseDto {
    id: string;
    userId: string;
    roadMapId: string;
    nestedRoadMapItemId?: string;
    extras: any[];
    createdAt: Date;
    updatedAt: Date;
}
