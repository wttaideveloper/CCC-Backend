import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Progress, ProgressDocument } from './schemas/progress.schema';
import { RoadMap, RoadMapDocument } from '../roadmaps/schemas/roadmap.schema';
import { Assessment, AssessmentDocument } from '../assessment/schemas/assessment.schema';
import { ProgressResponseDto, toProgressResponseDto } from './utils/progress.mapper';
import {
    AssignRoadmapDto,
    AssignAssessmentDto,
    UpdateRoadmapProgressDto,
    UpdateAssessmentProgressDto,
} from './dto/progress.dto';
import { PROGRESS_STATUSES } from '../../common/constants/status.constants';

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

    async assignRoadmap(dto: AssignRoadmapDto): Promise<ProgressResponseDto[]> {
        // Step 1: Validate all roadmaps exist and fetch their totalSteps in a single query
        const roadMaps = await this.roadMapModel.find(
            { _id: { $in: dto.roadMapIds } },
            { _id: 1, totalSteps: 1 }
        ).exec();

        if (roadMaps.length !== dto.roadMapIds.length) {
            const foundIds = roadMaps.map(r => r._id.toString());
            const missingIds = dto.roadMapIds.filter(id => !foundIds.includes(id.toString()));
            throw new NotFoundException(`RoadMap(s) not found: ${missingIds.join(', ')}`);
        }

        // Create a map for O(1) lookup of totalSteps by roadMapId
        const roadMapDataMap = new Map(roadMaps.map(r => [r._id.toString(), r.totalSteps || 0]));

        // Step 2: Fetch all existing progress records for all users in a single query (prevents N+1 problem)
        const existingProgressRecords = await this.progressModel.find(
            { userId: { $in: dto.userIds } }
        ).exec();

        // Create a map for O(1) lookup of existing progress by userId
        const progressByUserMap = new Map(
            existingProgressRecords.map(p => [p.userId.toString(), p])
        );

        const results: ProgressResponseDto[] = [];
        const errors: string[] = [];

        // Step 3: Process each user and assign roadmaps
        for (const userId of dto.userIds) {
            try {
                const existingProgress = progressByUserMap.get(userId.toString());

                // Get list of already assigned roadmap IDs for this user
                const existingRoadMapIds = existingProgress
                    ? existingProgress.roadmaps.map(r => r.roadMapId.toString())
                    : [];

                // Filter out roadmaps that are already assigned
                const newRoadMapIds = dto.roadMapIds.filter(
                    id => !existingRoadMapIds.includes(id.toString())
                );

                if (newRoadMapIds.length === 0) {
                    errors.push(`All roadmaps already assigned to user ${userId}`);
                    continue;
                }

                // Create entries for new roadmaps
                const newRoadmapEntries = newRoadMapIds.map(roadMapId => ({
                    roadMapId: roadMapId,
                    completedSteps: 0,
                    totalSteps: roadMapDataMap.get(roadMapId.toString()) || 0,
                    progressPercentage: 0,
                    status: PROGRESS_STATUSES.NOT_STARTED,
                }));

                // Update progress with all new roadmaps in a single atomic operation
                const updatedProgress = await this.progressModel.findOneAndUpdate(
                    { userId: userId },
                    {
                        $push: { roadmaps: { $each: newRoadmapEntries } }
                    },
                    {
                        new: true,
                        upsert: true,
                    }
                ).exec();

                results.push(toProgressResponseDto(updatedProgress));
            } catch (error) {
                errors.push(`Failed to assign roadmaps to user ${userId}: ${error.message}`);
            }
        }

        // If all assignments failed, throw an error
        if (errors.length > 0 && results.length === 0) {
            throw new BadRequestException(`Failed to assign roadmaps to all users: ${errors.join(', ')}`);
        }

        return results;
    }

    async assignAssessment(dto: AssignAssessmentDto): Promise<ProgressResponseDto> {
        const existingProgress = await this.progressModel.findOne({
            userId: dto.userId,
            'assessments.assessmentId': dto.assessmentId,
        }).exec();

        if (existingProgress) {
            throw new BadRequestException(`Assessment ${dto.assessmentId} is already assigned to this user.`);
        }

        const assessment = await this.assessmentModel.findById(dto.assessmentId).exec();
        if (!assessment) {
            throw new NotFoundException(`Assessment with ID ${dto.assessmentId} not found.`);
        }

        const newAssessmentEntry = {
            assessmentId: dto.assessmentId,
            completedSections: 0,
            totalSections: 0, //assessment.totalSections || needed
            progressPercentage: 0,
            status: PROGRESS_STATUSES.NOT_STARTED,
        };

        const updatedProgress = await this.progressModel.findOneAndUpdate(
            { userId: dto.userId },
            {
                $push: { assessments: newAssessmentEntry }
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
            { $set: { 'assessments.$.completedSections': dto.completedSections } },
            { new: true }
        ).exec();

        if (!updatedProgress) {
            throw new NotFoundException(`Assessment ${dto.assessmentId} not found for user ${dto.userId}.`);
        }
        return toProgressResponseDto(updatedProgress);
    }
}