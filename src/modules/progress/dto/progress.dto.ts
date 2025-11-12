import { IsMongoId, IsNumber, IsNotEmpty, Min, IsArray, ArrayMinSize } from 'class-validator';
import { Types } from 'mongoose';
import { Transform, Type } from 'class-transformer';

export class AssignRoadmapDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsMongoId({ each: true })
    @Transform(({ value }) => value.map((id: string) => Types.ObjectId.createFromHexString(id)))
    userIds: Types.ObjectId[];

    @IsArray()
    @ArrayMinSize(1)
    @IsMongoId({ each: true })
    @Transform(({ value }) => value.map((id: string) => Types.ObjectId.createFromHexString(id)))
    roadMapIds: Types.ObjectId[];
}

export class AssignAssessmentDto {
    @IsMongoId()
    @IsNotEmpty()
    @Transform(({ value }) => Types.ObjectId.createFromHexString(value))
    userId: Types.ObjectId;

    @IsMongoId()
    @IsNotEmpty()
    @Transform(({ value }) => Types.ObjectId.createFromHexString(value))
    assessmentId: Types.ObjectId;

}

export class UpdateRoadmapProgressDto {
    @IsMongoId()
    @IsNotEmpty()
    @Transform(({ value }) => Types.ObjectId.createFromHexString(value))
    userId: Types.ObjectId;

    @IsMongoId()
    @IsNotEmpty()
    @Transform(({ value }) => Types.ObjectId.createFromHexString(value))
    roadMapId: Types.ObjectId;

    @IsNumber()
    @Min(0)
    completedSteps: number;
}

export class UpdateAssessmentProgressDto {
    @IsMongoId()
    @IsNotEmpty()
    @Transform(({ value }) => Types.ObjectId.createFromHexString(value))
    userId: Types.ObjectId;

    @IsMongoId()
    @IsNotEmpty()
    @Transform(({ value }) => Types.ObjectId.createFromHexString(value))
    assessmentId: Types.ObjectId;

    @IsNumber()
    @Min(0)
    completedSections: number;
}