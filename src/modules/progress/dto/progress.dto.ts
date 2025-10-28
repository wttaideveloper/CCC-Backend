import { IsMongoId, IsNumber, IsNotEmpty, Min, IsOptional } from 'class-validator';
import { Types } from 'mongoose';

export class AssignRoadmapDto {
    @IsMongoId()
    @IsNotEmpty()
    userId: Types.ObjectId;

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
    @IsNotEmpty()
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
    @IsNotEmpty()
    score: number;
}