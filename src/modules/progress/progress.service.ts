import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Progress, ProgressDocument } from './schemas/progress.schema';
import { RoadMap, RoadMapDocument } from '../roadmaps/schemas/roadmap.schema';
import { Assessment, AssessmentDocument } from '../assessment/schemas/assessment.schema';
import { ProgressResponseDto, toProgressResponseDto } from './utils/progress.mapper';
import {
    AssignRoadmapDto,
    UpdateRoadmapProgressDto,
    UpdateAssessmentProgressDto,
} from './dto/progress.dto';

@Injectable()
export class ProgressService {
    constructor(
        @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
        @InjectModel(RoadMap.name) private roadMapModel: Model<RoadMapDocument>,
        @InjectModel(Assessment.name) private assessmentModel: Model<AssessmentDocument>,
    ) { }

    async findByUserId(userId: Types.ObjectId): Promise<ProgressResponseDto> {
        const progress = await this.progressModel.findOne({ userId }).exec();
        if (!progress) {
            throw new NotFoundException(`Progress record not found for user ${userId}.`);
        }
        return toProgressResponseDto(progress);
    }

    async assignRoadmap(dto: AssignRoadmapDto): Promise<ProgressResponseDto> {
        const existingProgress = await this.progressModel.findOne({
            userId: dto.userId,
            'roadmaps.roadMapId': dto.roadMapId,
        }).exec();

        if (existingProgress) {
            throw new BadRequestException(`RoadMap ${dto.roadMapId} is already assigned to this user.`);
        }

        const roadMap = await this.roadMapModel.findById(dto.roadMapId, { totalSteps: 1 }).exec();
        if (!roadMap) {
            throw new NotFoundException(`RoadMap with ID ${dto.roadMapId} not found.`);
        }

        const newRoadmapEntry = {
            roadMapId: dto.roadMapId,
            completedSteps: 0,
            totalSteps: roadMap.totalSteps || 0,
            progressPercentage: 0,
            status: 'not_started',
        };

        const updatedProgress = await this.progressModel.findOneAndUpdate(
            { userId: dto.userId },
            {
                $push: { roadmaps: newRoadmapEntry }
            },
            {
                new: true,
                upsert: true,
            }
        ).exec();

        return toProgressResponseDto(updatedProgress);
    }

    async updateRoadmapProgress(dto: UpdateRoadmapProgressDto): Promise<ProgressResponseDto> {
        const updatedProgress = await this.progressModel.findOneAndUpdate(
            { userId: dto.userId, 'roadmaps.roadMapId': dto.roadMapId },
            { $set: { 'roadmaps.$.completedSteps': dto.completedSteps } },
            { new: true }
        ).exec();

        if (!updatedProgress) {
            throw new NotFoundException(`Roadmap ${dto.roadMapId} not found for user ${dto.userId}.`);
        }
        return toProgressResponseDto(updatedProgress);
    }

    async updateAssessmentProgress(dto: UpdateAssessmentProgressDto): Promise<ProgressResponseDto> {
        const updatedProgress = await this.progressModel.findOneAndUpdate(
            { userId: dto.userId, 'assessments.assessmentId': dto.assessmentId },
            { $set: { 'assessments.$.score': dto.score } },
            { new: true }
        ).exec();

        if (!updatedProgress) {
            throw new NotFoundException(`Assessment ${dto.assessmentId} not found for user ${dto.userId}.`);
        }
        return toProgressResponseDto(updatedProgress);
    }
}