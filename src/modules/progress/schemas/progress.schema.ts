import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ProgressDocument = Progress & Document;

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
                enum: ["not_started", "in_progress", "completed"],
                default: "not_started",
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
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 0 },
            progressPercentage: { type: Number, default: 0 },
            status: {
                type: String,
                enum: ["not_started", "in_progress", "completed"],
                default: "not_started",
            },
        },
    ])
    assessments: {
        assessmentId: Types.ObjectId;
        score: number;
        maxScore: number;
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

ProgressSchema.pre<ProgressDocument>("save", function (next) {
    let totalRoadmapPercent = 0;
    let totalAssessmentPercent = 0;

    // --- Roadmaps ---
    let completedRoadmaps = 0;
    this.roadmaps.forEach((r) => {
        if (r.totalSteps > 0)
            r.progressPercentage = Math.min((r.completedSteps / r.totalSteps) * 100, 100);
        else r.progressPercentage = 0;

        if (r.progressPercentage >= 100) r.status = "completed";
        else if (r.progressPercentage > 0) r.status = "in_progress";
        else r.status = "not_started";

        totalRoadmapPercent += r.progressPercentage;
        if (r.status === "completed") completedRoadmaps++;
    });

    this.totalRoadmaps = this.roadmaps.length;
    this.completedRoadmaps = completedRoadmaps;
    this.overallRoadmapProgress =
        this.roadmaps.length > 0
            ? parseFloat((totalRoadmapPercent / this.roadmaps.length).toFixed(2))
            : 0;

    // --- Assessments ---
    let completedAssessments = 0;
    this.assessments.forEach((a) => {
        if (a.maxScore > 0)
            a.progressPercentage = Math.min((a.score / a.maxScore) * 100, 100);
        else a.progressPercentage = 0;

        if (a.progressPercentage >= 100) a.status = "completed";
        else if (a.progressPercentage > 0) a.status = "in_progress";
        else a.status = "not_started";

        totalAssessmentPercent += a.progressPercentage;
        if (a.status === "completed") completedAssessments++;
    });

    this.totalAssessments = this.assessments.length;
    this.completedAssessments = completedAssessments;
    this.overallAssessmentProgress =
        this.assessments.length > 0
            ? parseFloat((totalAssessmentPercent / this.assessments.length).toFixed(2))
            : 0;

    next();
});
