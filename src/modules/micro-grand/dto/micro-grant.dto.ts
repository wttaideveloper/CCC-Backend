import {
  IsString,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsOptional,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

class FieldDto {
  @IsString()
  label: string;

  @IsString()
  type: string;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsArray()
  @IsOptional()
  options?: string[];
}

export class CreateOrUpdateFormDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDto)
  fields: FieldDto[];
}

export class ApplyMicroGrantDto {
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @IsObject()
  @IsNotEmpty()
  answers: Record<string, any>;

  @IsString()
  @IsOptional()
  supportingDoc?: string;
}

export class UpdateApplicationStatusDto {
  @IsNotEmpty()
  @IsEnum(['new', 'pending', 'accepted', 'rejected'], {
    message: 'Status must be one of: new, pending, accepted',
  })
  status: string;
}
