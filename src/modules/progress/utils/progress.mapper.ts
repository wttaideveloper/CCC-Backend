import { Types } from 'mongoose';
import { ProgressDocument } from '../schemas/progress.schema';

class NestedRoadmapProgressDto {
    nestedRoadmapId: Types.ObjectId;
    completedSteps: number;
    totalSteps: number;
    progressPercentage: number;
    status: string;
}

class ProgressRoadmapDto {
    roadMapId: Types.ObjectId;
    completedSteps: number;
    totalSteps: number;
    progressPercentage: number;
    status: string;
    nestedRoadmaps: NestedRoadmapProgressDto[];
}

class ProgressAssessmentDto {
    assessmentId: Types.ObjectId;
    completedSections: number;
    totalSections: number;
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
    totalItems: number;
    completedItems: number;
    overallProgress: number;
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
            nestedRoadmaps: (r.nestedRoadmaps || []).map(nested => ({
                nestedRoadmapId: nested.nestedRoadmapId,
                completedSteps: nested.completedSteps,
                totalSteps: nested.totalSteps,
                progressPercentage: nested.progressPercentage,
                status: nested.status,
            })),
        })),
        totalRoadmaps: doc.totalRoadmaps,
        completedRoadmaps: doc.completedRoadmaps,
        overallRoadmapProgress: doc.overallRoadmapProgress,
        assessments: doc.assessments.map(a => ({
            assessmentId: a.assessmentId,
            completedSections: a.completedSections,
            totalSections: a.totalSections,
            progressPercentage: a.progressPercentage,
            status: a.status,
        })),
        totalAssessments: doc.totalAssessments,
        completedAssessments: doc.completedAssessments,
        overallAssessmentProgress: doc.overallAssessmentProgress,
        totalItems: doc.totalItems,
        completedItems: doc.completedItems,
        overallProgress: doc.overallProgress,
        // createdAt: doc.createdAt,
        // updatedAt: doc.updatedAt,
    };
}