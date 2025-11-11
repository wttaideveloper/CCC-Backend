import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { VALID_PROGRESS_STATUSES, PROGRESS_STATUSES } from '../../../common/constants/status.constants';

export type ProgressDocument = Document<unknown, {}, Progress> & Progress & {
    _id: Types.ObjectId;
};
@Schema({ timestamps: true })
export class Progress {
    @Prop({ type: Types.ObjectId, ref: "User", required: true })
    userId: Types.ObjectId;

    @Prop([
        {
            _id: false,
            roadMapId: { type: Types.ObjectId, ref: "RoadMap", required: true },
            completedSteps: { type: Number, default: 0 },
            totalSteps: { type: Number, default: 0 },
            progressPercentage: { type: Number, default: 0 },
            status: {
                type: String,
                enum: VALID_PROGRESS_STATUSES,
                default: PROGRESS_STATUSES.NOT_STARTED,
            },
        },
    ])
    roadmaps: {
        roadMapId: Types.ObjectId;
        completedSteps: number;
        totalSteps: number;
        progressPercentage: number;
        status: string;
    }[];

    @Prop({ type: Number, default: 0 })
    totalRoadmaps: number;

    @Prop({ type: Number, default: 0 })
    completedRoadmaps: number;

    @Prop({ type: Number, default: 0 })
    overallRoadmapProgress: number;

    @Prop([
        {
            _id: false,
            assessmentId: { type: Types.ObjectId, ref: "Assessment", required: true },
            completedSections: { type: Number, default: 0 },
            totalSections: { type: Number, default: 0 },
            progressPercentage: { type: Number, default: 0 },
            status: {
                type: String,
                enum: VALID_PROGRESS_STATUSES.filter(s => s !== PROGRESS_STATUSES.DUE),
                default: PROGRESS_STATUSES.NOT_STARTED,
            },
        },
    ])
    assessments: {
        assessmentId: Types.ObjectId;
        completedSections: number;
        totalSections: number;
        progressPercentage: number;
        status: string;
    }[];

    @Prop({ type: Number, default: 0 })
    totalAssessments: number;

    @Prop({ type: Number, default: 0 })
    completedAssessments: number;

    @Prop({ type: Number, default: 0 })
    overallAssessmentProgress: number;
}

export const ProgressSchema = SchemaFactory.createForClass(Progress);

// Helper function to calculate progress (used by both save and findOneAndUpdate hooks)
function calculateProgress(doc: any) {
    let totalRoadmapPercent = 0;
    let totalAssessmentPercent = 0;

    // --- Roadmaps ---
    let completedRoadmaps = 0;
    doc.roadmaps.forEach((r: any) => {
        // Calculate progress percentage
        if (r.totalSteps > 0)
            r.progressPercentage = Math.min((r.completedSteps / r.totalSteps) * 100, 100);
        else r.progressPercentage = 0;

        // Automatically update status based on progress
        if (r.progressPercentage >= 100) r.status = PROGRESS_STATUSES.COMPLETED;
        else if (r.progressPercentage > 0) r.status = PROGRESS_STATUSES.IN_PROGRESS;
        else r.status = PROGRESS_STATUSES.NOT_STARTED;

        totalRoadmapPercent += r.progressPercentage;
        if (r.status === PROGRESS_STATUSES.COMPLETED) completedRoadmaps++;
    });

    doc.totalRoadmaps = doc.roadmaps.length;
    doc.completedRoadmaps = completedRoadmaps;
    doc.overallRoadmapProgress =
        doc.roadmaps.length > 0
            ? parseFloat((totalRoadmapPercent / doc.roadmaps.length).toFixed(2))
            : 0;

    // --- Assessments ---
    let completedAssessments = 0;
    doc.assessments.forEach((a: any) => {
        // Calculate progress percentage
        if (a.totalSections > 0)
            a.progressPercentage = Math.min((a.completedSections / a.totalSections) * 100, 100);
        else a.progressPercentage = 0;

        // Automatically update status based on progress
        if (a.progressPercentage >= 100) a.status = PROGRESS_STATUSES.COMPLETED;
        else if (a.progressPercentage > 0) a.status = PROGRESS_STATUSES.IN_PROGRESS;
        else a.status = PROGRESS_STATUSES.NOT_STARTED;

        totalAssessmentPercent += a.progressPercentage;
        if (a.status === PROGRESS_STATUSES.COMPLETED) completedAssessments++;
    });

    doc.totalAssessments = doc.assessments.length;
    doc.completedAssessments = completedAssessments;
    doc.overallAssessmentProgress =
        doc.assessments.length > 0
            ? parseFloat((totalAssessmentPercent / doc.assessments.length).toFixed(2))
            : 0;
}

// Pre-save hook (for .create() and .save() operations)
ProgressSchema.pre<ProgressDocument>("save", function (next) {
    calculateProgress(this);
    next();
});

// Post-findOneAndUpdate hook to recalculate progress after updates
ProgressSchema.post("findOneAndUpdate", async function (doc) {
    if (doc) {
        calculateProgress(doc);
        await doc.save();
    }
});

ProgressSchema.index({ userId: 1 });
ProgressSchema.index({ userId: 1, 'roadmaps.roadMapId': 1 });
ProgressSchema.index({ userId: 1, 'assessments.assessmentId': 1 });
ProgressSchema.index({ createdAt: 1 });
ProgressSchema.index({ updatedAt: -1 });
