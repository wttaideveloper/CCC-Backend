import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PreSurveyAnswerDto {
    @IsString()
    @IsNotEmpty()
    questionText: string;

    @IsNotEmpty()
    answer: string | number | boolean;
}

export class SubmitPreSurveyDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PreSurveyAnswerDto)
    preSurveyAnswers: PreSurveyAnswerDto[];
}
