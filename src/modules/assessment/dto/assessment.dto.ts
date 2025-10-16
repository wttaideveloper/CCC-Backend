import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChoiceDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class LayerDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsArray()
  @IsOptional()
  choices?: ChoiceDto[];
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
  @IsNotEmpty()
  roadmapId: string;

  @IsArray()
  sections: SectionDto[];
}
