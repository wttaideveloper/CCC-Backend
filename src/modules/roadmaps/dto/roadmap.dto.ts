import { IsString, IsOptional, IsDateString, IsBoolean, IsEnum, IsArray, ArrayMinSize, ValidateNested, IsNumber, IsMongoId, ValidateIf, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class TextFieldExtraDto {
    @IsIn(['TEXT_FIELD'])
    type: 'TEXT_FIELD';

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    placeHolder?: string;

    @IsOptional()
    @IsString()
    buttonName?: string;
}

export class TextAreaExtraDto {
    @IsIn(['TEXT_AREA'])
    type: 'TEXT_AREA';

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    placeHolder?: string;

    @IsOptional()
    @IsString()
    buttonName?: string;
}

export class UploadExtraDto {
    @IsIn(['UPLOAD'])
    type: 'UPLOAD';

    @IsString()
    name: string;
}

export class DatePickerExtraDto {
    @IsIn(['DATE_PICKER'])
    type: 'DATE_PICKER';

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    date?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    checkboxes?: string[];

    @IsOptional()
    @IsString()
    buttonName?: string;
}

export class AssessmentExtraDto {
    @IsIn(['ASSESSMENT'])
    type: 'ASSESSMENT';

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    buttonName?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    checkboxes?: string[];
}

export class SectionExtraDto {
    @IsIn(['SECTION'])
    type: 'SECTION';

    @IsString()
    name: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    checkboxes?: string[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object, {
        discriminator: {
            property: 'type',
            subTypes: [
                { value: TextFieldExtraDto, name: 'TEXT_FIELD' },
                { value: TextAreaExtraDto, name: 'TEXT_AREA' },
                { value: UploadExtraDto, name: 'UPLOAD' },
                { value: DatePickerExtraDto, name: 'DATE_PICKER' },
                { value: AssessmentExtraDto, name: 'ASSESSMENT' },
            ],
        },
    })
    sections?: (TextFieldExtraDto | TextAreaExtraDto | UploadExtraDto | DatePickerExtraDto | AssessmentExtraDto)[];
}

export type ExtraItemDto = TextFieldExtraDto | TextAreaExtraDto | UploadExtraDto | DatePickerExtraDto | SectionExtraDto | AssessmentExtraDto;

export class NestedRoadMapItemDto {

    @IsOptional()
    @IsMongoId()
    readonly _id?: string;

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    roadMapDetails?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(['in progress', 'not started', 'completed'])
    @IsOptional()
    status?: 'in progress' | 'not started' | 'completed';

    @IsString()
    duration: string;

    @IsOptional()
    @IsDateString()
    startDate?: Date;

    @IsOptional()
    @IsDateString()
    endDate?: Date;

    @IsOptional()
    @IsDateString()
    completedOn?: Date;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsArray()
    @IsDateString({}, { each: true })
    meetings?: Date[];

    @IsOptional()
    @IsString()
    phase?: string;

    @IsOptional()
    @IsNumber()
    totalSteps?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object, {
        discriminator: {
            property: 'type',
            subTypes: [
                { value: TextFieldExtraDto, name: 'TEXT_FIELD' },
                { value: TextAreaExtraDto, name: 'TEXT_AREA' },
                { value: UploadExtraDto, name: 'UPLOAD' },
                { value: DatePickerExtraDto, name: 'DATE_PICKER' },
                { value: SectionExtraDto, name: 'SECTION' },
                { value: AssessmentExtraDto, name: 'ASSESSMENT' },
            ],
        },
    })
    extras?: ExtraItemDto[];
}

export class CreateRoadMapDto {
    @IsString()
    type: string;

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    roadMapDetails?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(['in progress', 'not started', 'completed'])
    @IsOptional()
    status?: 'in progress' | 'not started' | 'completed';

    @IsString()
    duration: string;

    @IsOptional()
    @IsDateString()
    startDate?: Date;

    @IsOptional()
    @IsDateString()
    endDate?: Date;

    @IsOptional()
    @IsDateString()
    completedOn?: Date;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsArray()
    @IsDateString({}, { each: true })
    meetings?: Date[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object, {
        discriminator: {
            property: 'type',
            subTypes: [
                { value: TextFieldExtraDto, name: 'TEXT_FIELD' },
                { value: TextAreaExtraDto, name: 'TEXT_AREA' },
                { value: UploadExtraDto, name: 'UPLOAD' },
                { value: DatePickerExtraDto, name: 'DATE_PICKER' },
                { value: SectionExtraDto, name: 'SECTION' },
                { value: AssessmentExtraDto, name: 'ASSESSMENT' },
            ],
        },
    })
    extras?: ExtraItemDto[];

    @IsOptional()
    @IsString()
    divisions?: string[];

    @IsOptional()
    @IsString()
    phase?: string;

    @IsOptional()
    @IsMongoId()
    assesmentId?: string;

    @IsOptional()
    @IsNumber()
    totalSteps?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => NestedRoadMapItemDto)
    roadmaps?: NestedRoadMapItemDto[];
}

export class UpdateRoadMapDto extends PartialType(CreateRoadMapDto) { }

export class RoadMapResponseDto {
    _id: string;
    type: string;
    name: string;
    roadMapDetails?: string;
    description?: string;
    status: string;
    duration?: string;
    startDate?: Date;
    endDate?: Date;
    completedOn?: Date;
    imageUrl?: string;
    meetings?: Date[];
    extras?: ExtraItemDto[];
    divisions?: string[];
    haveNextedRoadMaps: boolean;
    phase?: string;
    assesmentId?: string;
    totalSteps?: number;
    roadmaps: NestedRoadMapItemDto[];
    createdAt?: Date;
    updatedAt?: Date;
}