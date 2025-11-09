import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { VALID_ASSESSMENT_TYPES } from '../../../common/constants/status.constants';
import { Type } from 'class-transformer';

export class ChoiceDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class LayerDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsArray()
  @IsOptional()
  choices?: ChoiceDto[];
}

export class PreSurveyQuestionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsIn(['text', 'number', 'date', 'select'])
  type: string;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsBoolean()
  required: boolean;
}

export class SectionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  bannerImage?: string;

  @IsArray()
  layers: LayerDto[];
}

export class CreateAssessmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsOptional()
  instructions?: string[];

  @IsString()
  @IsOptional()
  bannerImage?: string;

  @IsString()
  @IsOptional()
  roadmapId: string;

  @IsString()
  @IsIn(VALID_ASSESSMENT_TYPES)
  type: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreSurveyQuestionDto)
  @IsOptional()
  preSurvey?: PreSurveyQuestionDto[];

  @IsArray()
  sections: SectionDto[];
}
