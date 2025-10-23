import { Types } from 'mongoose';
import { ProgressDocument } from '../schemas/progress.schema';

class ProgressRoadmapDto {
    roadMapId: Types.ObjectId;
    completedSteps: number;
    totalSteps: number;
    progressPercentage: number;
    status: string;
}

class ProgressAssessmentDto {
    assessmentId: Types.ObjectId;
    score: number;
    maxScore: number;
    progressPercentage: number;
    status: string;
}

export class ProgressResponseDto {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    roadmaps: ProgressRoadmapDto[];
    totalRoadmaps: number;
    completedRoadmaps: number;
    overallRoadmapProgress: number;
    assessments: ProgressAssessmentDto[];
    totalAssessments: number;
    completedAssessments: number;
    overallAssessmentProgress: number;
    // createdAt: Date;
    // updatedAt: Date;
}

export function toProgressResponseDto(doc: ProgressDocument): ProgressResponseDto {
    return {
        _id: doc._id,
        userId: doc.userId,
        roadmaps: doc.roadmaps.map(r => ({
            roadMapId: r.roadMapId,
            completedSteps: r.completedSteps,
            totalSteps: r.totalSteps,
            progressPercentage: r.progressPercentage,
            status: r.status,
        })),
        totalRoadmaps: doc.totalRoadmaps,
        completedRoadmaps: doc.completedRoadmaps,
        overallRoadmapProgress: doc.overallRoadmapProgress,
        assessments: doc.assessments.map(a => ({
            assessmentId: a.assessmentId,
            score: a.score,
            maxScore: a.maxScore,
            progressPercentage: a.progressPercentage,
            status: a.status,
        })),
        totalAssessments: doc.totalAssessments,
        completedAssessments: doc.completedAssessments,
        overallAssessmentProgress: doc.overallAssessmentProgress,
        // createdAt: doc.createdAt,
        // updatedAt: doc.updatedAt,
    };
}