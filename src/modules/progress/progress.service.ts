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
    AddFinalCommentDto,
    UpdateFinalCommentDto,
    DeleteFinalCommentDto,
} from './dto/progress.dto';
import { PROGRESS_STATUSES } from '../../common/constants/status.constants';

@Injectable()
export class ProgressService {
    constructor(
        @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
        @InjectModel(RoadMap.name) private roadMapModel: Model<RoadMapDocument>,
        @InjectModel(Assessment.name) private assessmentModel: Model<AssessmentDocument>,
    ) { }

    async findByUserId(userId: Types.ObjectId): Promise<ProgressResponseDto | null> {
        const userObjectId: Types.ObjectId = userId;
        const userIdString: string = userId.toString();

        const progress = await this.progressModel.findOne({
            $or: [
                { userId: userObjectId },
                { userId: userIdString }
            ]
        }).exec();

        if (!progress) {
            return null;
        }
        return toProgressResponseDto(progress);
    }

    async assignRoadmap(dto: AssignRoadmapDto): Promise<ProgressResponseDto[]> {
        // Step 1: Validate all roadmaps exist and fetch their data including nested roadmaps
        const roadMaps = await this.roadMapModel.find(
            { _id: { $in: dto.roadMapIds } },
            { _id: 1, totalSteps: 1, roadmaps: 1 }
        ).exec();

        if (roadMaps.length !== dto.roadMapIds.length) {
            const foundIds = roadMaps.map(r => r._id.toString());
            const missingIds = dto.roadMapIds.filter(id => !foundIds.includes(id.toString()));
            throw new NotFoundException(`RoadMap(s) not found: ${missingIds.join(', ')}`);
        }

        // Create a map for O(1) lookup of roadmap data by roadMapId
        const roadMapDataMap = new Map(roadMaps.map(r => [
            r._id.toString(),
            {
                totalSteps: r.totalSteps || 0,
                nestedRoadmaps: r.roadmaps || []
            }
        ]));

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

                // Create entries for new roadmaps with nested roadmaps
                const newRoadmapEntries = newRoadMapIds.map(roadMapId => {
                    const roadMapData = roadMapDataMap.get(roadMapId.toString());
                    const nestedRoadmapsData = roadMapData?.nestedRoadmaps || [];

                    // Create nested roadmap entries
                    const nestedRoadmaps = nestedRoadmapsData.map((nested: any) => ({
                        nestedRoadmapId: nested._id,
                        completedSteps: 0,
                        totalSteps: nested.totalSteps || 0,
                        progressPercentage: 0,
                        status: PROGRESS_STATUSES.NOT_STARTED,
                    }));

                    return {
                        roadMapId: roadMapId,
                        completedSteps: 0,
                        totalSteps: roadMapData?.totalSteps || 0,
                        progressPercentage: 0,
                        status: PROGRESS_STATUSES.NOT_STARTED,
                        nestedRoadmaps: nestedRoadmaps,
                    };
                });

                // Update progress with all new roadmaps in a single atomic operation
                const updatedProgress = await this.progressModel.findOneAndUpdate(
                    { userId: userId },
                    {
                        $push: { roadmaps: { $each: newRoadmapEntries } },
                        $setOnInsert: { userId: userId }
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
        const totalSections = assessment.sections?.length || 0;

        const newAssessmentEntry = {
            assessmentId: dto.assessmentId,
            completedSections: 0,
            totalSections: totalSections,
            progressPercentage: 0,
            status: PROGRESS_STATUSES.NOT_STARTED,
        };

        const updatedProgress = await this.progressModel.findOneAndUpdate(
            { userId: dto.userId },
            {
                $push: { assessments: newAssessmentEntry },
                $setOnInsert: { userId: dto.userId }
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

    async addFinalComment(dto: AddFinalCommentDto): Promise<ProgressResponseDto> {
        const newComment = {
            _id: new Types.ObjectId(),
            commentorId: dto.commentorId,
            comment: dto.comment,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const updatedProgress = await this.progressModel.findOneAndUpdate(
            { userId: dto.userId },
            {
                $push: { finalComments: newComment },
                $setOnInsert: { userId: dto.userId }
            },
            {
                new: true,
                upsert: true,
            }
        ).exec();

        if (!updatedProgress) {
            throw new NotFoundException(`Progress record not found for user ${dto.userId}.`);
        }

        return toProgressResponseDto(updatedProgress);
    }

    async getFinalComments(userId: Types.ObjectId): Promise<ProgressResponseDto['finalComments']> {
        const progress = await this.progressModel
            .findOne({ userId })
            .select('finalComments')
            .sort({ 'finalComments.createdAt': -1 })
            .exec();

        if (!progress) {
            return [];
        }

        return progress.finalComments || [];
    }

    async updateFinalComment(dto: UpdateFinalCommentDto): Promise<ProgressResponseDto> {
        const updatedProgress = await this.progressModel.findOneAndUpdate(
            {
                userId: dto.userId,
                'finalComments._id': dto.commentId
            },
            {
                $set: {
                    'finalComments.$.comment': dto.comment,
                    'finalComments.$.updatedAt': new Date(),
                }
            },
            { new: true }
        ).exec();

        if (!updatedProgress) {
            throw new NotFoundException(
                `Comment ${dto.commentId} not found for user ${dto.userId}.`
            );
        }

        return toProgressResponseDto(updatedProgress);
    }

    async deleteFinalComment(dto: DeleteFinalCommentDto): Promise<ProgressResponseDto> {
        const updatedProgress = await this.progressModel.findOneAndUpdate(
            { userId: dto.userId },
            {
                $pull: { finalComments: { _id: dto.commentId } }
            },
            { new: true }
        ).exec();

        if (!updatedProgress) {
            throw new NotFoundException(`Progress record not found for user ${dto.userId}.`);
        }

        return toProgressResponseDto(updatedProgress);
    }
}