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

export class FieldDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  options?: string[];
}

export class SectionDto {
  @IsString()
  @IsNotEmpty()
  section_title: string;

  @IsOptional()
  @IsString()
  section_intro?: string;

  @IsOptional()
  @IsString()
  reportingProcedure?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDto)
  fields: FieldDto[];
}


export class CreateOrUpdateFormDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  sections: SectionDto[];

  @IsString()
  @IsOptional()
  reportingProcedure?: string;
}

export class ApplyMicroGrantDto {
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @IsNotEmpty()
  answers: any;

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
