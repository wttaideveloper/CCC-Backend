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
import { VALID_USER_APPLICATION_STATUSES } from '../../../common/constants/status.constants';

class FieldDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
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
  @IsNotEmpty()
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
  @IsEnum(VALID_USER_APPLICATION_STATUSES, {
    message: `Status must be one of: ${VALID_USER_APPLICATION_STATUSES.join(', ')}`,
  })
  status: string;
}
