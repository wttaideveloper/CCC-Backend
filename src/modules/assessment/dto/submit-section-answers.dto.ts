import {
    IsString,
    IsNotEmpty,
    IsArray,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LayerAnswerDto {
    @IsString()
    @IsNotEmpty()
    layerId: string;

    @IsString()
    @IsNotEmpty()
    selectedChoice: string;
}

export class SectionAnswerDto {
    @IsString()
    @IsNotEmpty()
    sectionId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LayerAnswerDto)
    layers: LayerAnswerDto[];
}

export class SubmitSectionAnswersDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SectionAnswerDto)
    answers: SectionAnswerDto[];
}