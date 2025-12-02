import {
    IsString,
    IsOptional,
    IsBoolean,
    IsArray,
    IsNumber,
    IsEnum,
    ValidateNested,
    IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VALID_FIELD_TYPES } from '../schemas/interest-form-fields.schema';

export class DynamicFieldDto {
    @IsString()
    @IsNotEmpty()
    fieldId: string;

    @IsString()
    @IsNotEmpty()
    label: string;

    @IsEnum(VALID_FIELD_TYPES)
    type: string;

    @IsOptional()
    @IsString()
    placeholder?: string;

    @IsOptional()
    @IsBoolean()
    required?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    options?: string[];

    @IsOptional()
    @IsNumber()
    order?: number;

    @IsOptional()
    @IsString()
    section?: string;
}

export class AddDynamicFieldDto extends DynamicFieldDto {}

export class UpdateDynamicFieldsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DynamicFieldDto)
    fields: DynamicFieldDto[];
}

export class DynamicFieldResponseDto {
    fieldId: string;
    label: string;
    type: string;
    placeholder?: string;
    required: boolean;
    options: string[];
    order: number;
    section?: string;
}

export class StaticFieldResponseDto {
    fieldId: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
    section: string;
}

export class InterestFormFieldsResponseDto {
    staticFields: StaticFieldResponseDto[];
    dynamicFields: DynamicFieldResponseDto[];
}

export class DynamicFieldsConfigResponseDto {
    _id: string;
    fields: DynamicFieldResponseDto[];
    updatedAt: Date;
}
