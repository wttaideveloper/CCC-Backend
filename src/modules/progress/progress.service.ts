import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Progress, ProgressDocument } from './schemas/progress.schema';
import { RoadMap, RoadMapDocument } from '../roadmaps/schemas/roadmap.schema';
import { Assessment, AssessmentDocument } from '../assessment/schemas/assessment.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ProgressResponseDto, toProgressResponseDto, UserOverallProgressDto, DirectorOverviewDto, MonthlyCompletionDto } from './utils/progress.mapper';
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
        @InjectModel(User.name) private userModel: Model<UserDocument>,
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

    async getOverallProgressByRoles(roles: string[]): Promise<UserOverallProgressDto[]> {
        const users = await this.userModel.find(
            { role: { $in: roles } },
            { _id: 1, firstName: 1, lastName: 1, email: 1, role: 1, profilePicture: 1 }
        ).lean().exec();

        if (users.length === 0) {
            return [];
        }

        const userIds = users.map(u => u._id);

        const progressRecords = await this.progressModel.find(
            { userId: { $in: userIds } },
            {
                userId: 1,
                totalRoadmaps: 1,
                completedRoadmaps: 1,
                overallRoadmapProgress: 1,
                totalAssessments: 1,
                completedAssessments: 1,
                overallAssessmentProgress: 1,
                totalItems: 1,
                completedItems: 1,
                overallProgress: 1,
                overallCompleted: 1,
            }
        ).lean().exec();

        const progressMap = new Map(
            progressRecords.map(p => [p.userId.toString(), p])
        );

        const result: UserOverallProgressDto[] = users.map(user => {
            const progress = progressMap.get(user._id.toString());

            return {
                userId: user._id.toString(),
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture || undefined,
                totalRoadmaps: progress?.totalRoadmaps || 0,
                completedRoadmaps: progress?.completedRoadmaps || 0,
                overallRoadmapProgress: progress?.overallRoadmapProgress || 0,
                totalAssessments: progress?.totalAssessments || 0,
                completedAssessments: progress?.completedAssessments || 0,
                overallAssessmentProgress: progress?.overallAssessmentProgress || 0,
                totalItems: progress?.totalItems || 0,
                completedItems: progress?.completedItems || 0,
                overallProgress: progress?.overallProgress || 0,
                overallCompleted: progress?.overallCompleted || false,
            };
        });

        return result;
    }

    async getDirectorOverview(period: string = 'yearly', year: number = new Date().getFullYear(), includeUserDetails: boolean = false): Promise<DirectorOverviewDto> {
        const mentorRoles = ['mentor', 'field-mentor'];
        const pastorRoles = ['pastor', 'lay-leader', 'seminarian'];
        const allRoles = [...mentorRoles, ...pastorRoles];

        const allUsers = await this.userModel.find(
            { role: { $in: allRoles } },
            { _id: 1, firstName: 1, lastName: 1, email: 1, role: 1, profilePicture: 1, createdAt: 1 }
        ).lean().exec();

        const mentorUsers = allUsers.filter(u => mentorRoles.includes(u.role));
        const pastorUsers = allUsers.filter(u => pastorRoles.includes(u.role));

        const allUserIds = allUsers.map(u => u._id);
        const mentorUserIds = mentorUsers.map(u => u._id);
        const pastorUserIds = pastorUsers.map(u => u._id);

        const progressRecords = await this.progressModel.find(
            { userId: { $in: allUserIds } },
            {
                userId: 1,
                totalRoadmaps: 1,
                completedRoadmaps: 1,
                overallRoadmapProgress: 1,
                totalAssessments: 1,
                completedAssessments: 1,
                overallAssessmentProgress: 1,
                totalItems: 1,
                completedItems: 1,
                overallProgress: 1,
                overallCompleted: 1,
                updatedAt: 1,
            }
        ).lean().exec();

        const progressMap = new Map(
            progressRecords.map(p => [p.userId.toString(), p])
        );

        let completedMentorsCount = 0;
        let totalMentorsProgress = 0;
        let mentorsWithProgress = 0;

        mentorUserIds.forEach(userId => {
            const progress = progressMap.get(userId.toString());
            if (progress) {
                if (progress.overallCompleted) {
                    completedMentorsCount++;
                }
                totalMentorsProgress += progress.overallProgress || 0;
                mentorsWithProgress++;
            }
        });

        const mentorsOverallProgress = mentorsWithProgress > 0
            ? parseFloat((totalMentorsProgress / mentorUserIds.length).toFixed(2))
            : 0;

        let completedPastorsCount = 0;
        let totalPastorsProgress = 0;
        let pastorsWithProgress = 0;

        pastorUserIds.forEach(userId => {
            const progress = progressMap.get(userId.toString());
            if (progress) {
                if (progress.overallCompleted) {
                    completedPastorsCount++;
                }
                totalPastorsProgress += progress.overallProgress || 0;
                pastorsWithProgress++;
            }
        });

        const pastorsOverallProgress = pastorsWithProgress > 0
            ? parseFloat((totalPastorsProgress / pastorUserIds.length).toFixed(2))
            : 0;

        const totalUsers = allUsers.length;
        const completedUsers = completedMentorsCount + completedPastorsCount;
        const combinedTotalProgress = totalMentorsProgress + totalPastorsProgress;
        const overallCombinedProgress = totalUsers > 0
            ? parseFloat((combinedTotalProgress / totalUsers).toFixed(2))
            : 0;

        const monthlyData = this.generateMonthlyData(
            progressRecords,
            mentorUserIds,
            pastorUserIds,
            period,
            year
        );

        let userDetails: UserOverallProgressDto[] | undefined = undefined;
        if (includeUserDetails) {
            userDetails = allUsers.map(user => {
                const progress = progressMap.get(user._id.toString());
                return {
                    userId: user._id.toString(),
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: user.role,
                    profilePicture: user.profilePicture || undefined,
                    totalRoadmaps: progress?.totalRoadmaps || 0,
                    completedRoadmaps: progress?.completedRoadmaps || 0,
                    overallRoadmapProgress: progress?.overallRoadmapProgress || 0,
                    totalAssessments: progress?.totalAssessments || 0,
                    completedAssessments: progress?.completedAssessments || 0,
                    overallAssessmentProgress: progress?.overallAssessmentProgress || 0,
                    totalItems: progress?.totalItems || 0,
                    completedItems: progress?.completedItems || 0,
                    overallProgress: progress?.overallProgress || 0,
                    overallCompleted: progress?.overallCompleted || false,
                };
            });
        }

        return {
            totalMentors: mentorUsers.length,
            completedMentors: completedMentorsCount,
            mentorsOverallProgress,

            totalPastors: pastorUsers.length,
            completedPastors: completedPastorsCount,
            pastorsOverallProgress,

            totalUsers,
            completedUsers,
            overallCombinedProgress,

            monthlyData,
            users: userDetails,
        };
    }

    private generateMonthlyData(
        progressRecords: any[],
        mentorUserIds: Types.ObjectId[],
        pastorUserIds: Types.ObjectId[],
        period: string,
        year: number
    ): MonthlyCompletionDto[] {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Determine the months to include based on period
        let months: number[] = [];
        if (period === 'yearly') {
            months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // All 12 months
        } else if (period === 'half-yearly') {
            const currentMonth = new Date().getMonth();
            if (currentMonth < 6) {
                months = [0, 1, 2, 3, 4, 5]; // First half
            } else {
                months = [6, 7, 8, 9, 10, 11]; // Second half
            }
        }

        // Create a map of userId to progress completion date
        const completionMap = new Map<string, Date>();
        progressRecords.forEach(progress => {
            if (progress.overallCompleted && progress.updatedAt) {
                completionMap.set(progress.userId.toString(), new Date(progress.updatedAt));
            }
        });

        // Calculate completions per month
        const monthlyResults: MonthlyCompletionDto[] = months.map(month => {
            let mentorsCompleted = 0;
            let pastorsCompleted = 0;

            // Count mentor completions for this month
            mentorUserIds.forEach(userId => {
                const completionDate = completionMap.get(userId.toString());
                if (completionDate &&
                    completionDate.getFullYear() === year &&
                    completionDate.getMonth() === month) {
                    mentorsCompleted++;
                }
            });

            // Count pastor completions for this month
            pastorUserIds.forEach(userId => {
                const completionDate = completionMap.get(userId.toString());
                if (completionDate &&
                    completionDate.getFullYear() === year &&
                    completionDate.getMonth() === month) {
                    pastorsCompleted++;
                }
            });

            return {
                month: month + 1,
                year,
                monthName: monthNames[month],
                mentorsCompleted,
                pastorsCompleted,
            };
        });

        return monthlyResults;
    }
}