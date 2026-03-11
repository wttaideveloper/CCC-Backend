import {
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { VALID_ASSESSMENT_TYPES } from '../../../common/constants/status.constants';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

export class ChoiceDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class RecommendationLevelDto {

  @IsNotEmpty()
  level: number;

  @IsArray()
  @IsString({ each: true })
  items: string[];

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayerDto)
  layers: LayerDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecommendationLevelDto)
  recommendations: RecommendationLevelDto[];
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

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  instructions?: string[];
}

export class SectionRecommendationDto {

  @IsString()
  sectionTitle: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecommendationLevelDto)
  recommendations: RecommendationLevelDto[];

}

export class AssignAssessmentDto {

  assessmentId: Types.ObjectId;
  userIds: Types.ObjectId[];
  assignedBy: Types.ObjectId;
  dueDate?: Date;

}

export class SendSectionRecommendationsDto {

  @IsMongoId()
  userId: string;

  @IsArray()
  sections: {
    sectionId: string;
    recommendations: string[];
  }[];

}