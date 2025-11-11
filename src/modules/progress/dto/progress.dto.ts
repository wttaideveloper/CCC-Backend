import { IsMongoId, IsNumber, IsNotEmpty, Min, IsArray, ArrayMinSize } from 'class-validator';
import { Types } from 'mongoose';

export class AssignRoadmapDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsMongoId({ each: true })
    userIds: Types.ObjectId[];

    @IsMongoId()
    @IsNotEmpty()
    roadMapId: Types.ObjectId;
}

export class AssignAssessmentDto {
    @IsMongoId()
    @IsNotEmpty()
    userId: Types.ObjectId;

    @IsMongoId()
    @IsNotEmpty()
    assessmentId: Types.ObjectId;

}

export class UpdateRoadmapProgressDto {
    @IsMongoId()
    @IsNotEmpty()
    userId: Types.ObjectId;

    @IsMongoId()
    @IsNotEmpty()
    roadMapId: Types.ObjectId;

    @IsNumber()
    @Min(0)
    completedSteps: number;
}

export class UpdateAssessmentProgressDto {
    @IsMongoId()
    @IsNotEmpty()
    userId: Types.ObjectId;

    @IsMongoId()
    @IsNotEmpty()
    assessmentId: Types.ObjectId;

    @IsNumber()
    @Min(0)
    completedSections: number;
}