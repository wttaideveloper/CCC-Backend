import { Controller, Get, Param, Patch, Post, Body, Delete } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { Types } from 'mongoose';
import {
    AssignRoadmapDto,
    AssignAssessmentDto,
    UpdateRoadmapProgressDto,
    UpdateAssessmentProgressDto,
    AddFinalCommentDto,
    UpdateFinalCommentDto,
    DeleteFinalCommentDto,
} from './dto/progress.dto';
import { ProgressResponseDto } from './utils/progress.mapper';
import { BaseResponse } from '../../shared/interfaces/base-response.interface';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';

@Controller('progress')
export class ProgressController {
    constructor(private readonly progressService: ProgressService) { }

    @Get(':userId')
    async getProgress(
        @Param('userId', ParseMongoIdPipe) userId: Types.ObjectId,
    ): Promise<BaseResponse<ProgressResponseDto | null>> {
        const progress = await this.progressService.findByUserId(userId);
        return {
            success: true,
            message: progress ? 'User progress fetched successfully.' : 'No progress record found for this user.',
            data: progress,
        };
    }

    @Post('assign-roadmap')
    async assignRoadmap(
        @Body() dto: AssignRoadmapDto,
    ): Promise<BaseResponse<ProgressResponseDto[]>> {
        const progress = await this.progressService.assignRoadmap(dto);
        const totalAssignments = dto.userIds.length * dto.roadMapIds.length;
        return {
            success: true,
            message: `Successfully assigned ${dto.roadMapIds.length} roadmap(s) to ${dto.userIds.length} user(s). Total: ${totalAssignments} assignments.`,
            data: progress,
        };
    }

    @Post('assign-assessment')
    async assignAssessment(
        @Body() dto: AssignAssessmentDto,
    ): Promise<BaseResponse<ProgressResponseDto>> {
        const progress = await this.progressService.assignAssessment(dto);
        return {
            success: true,
            message: 'Assessment assigned and progress record updated.',
            data: progress,
        };
    }

    @Patch('roadmap/update')
    async updateRoadmapProgress(
        @Body() dto: UpdateRoadmapProgressDto,
    ): Promise<BaseResponse<ProgressResponseDto>> {
        const progress = await this.progressService.updateRoadmapProgress(dto);
        return {
            success: true,
            message: 'RoadMap progress updated successfully.',
            data: progress,
        };
    }

    @Patch('assessment/update')
    async updateAssessmentProgress(
        @Body() dto: UpdateAssessmentProgressDto,
    ): Promise<BaseResponse<ProgressResponseDto>> {
        const progress = await this.progressService.updateAssessmentProgress(dto);
        return {
            success: true,
            message: 'Assessment score updated successfully.',
            data: progress,
        };
    }

    @Post('final-comments')
    async addFinalComment(
        @Body() dto: AddFinalCommentDto,
    ): Promise<BaseResponse<ProgressResponseDto>> {
        const progress = await this.progressService.addFinalComment(dto);
        return {
            success: true,
            message: 'Final comment added successfully.',
            data: progress,
        };
    }

    @Get(':userId/final-comments')
    async getFinalComments(
        @Param('userId', ParseMongoIdPipe) userId: Types.ObjectId,
    ): Promise<BaseResponse<ProgressResponseDto['finalComments']>> {
        const comments = await this.progressService.getFinalComments(userId);
        return {
            success: true,
            message: 'Final comments fetched successfully.',
            data: comments,
        };
    }

    @Patch('final-comments')
    async updateFinalComment(
        @Body() dto: UpdateFinalCommentDto,
    ): Promise<BaseResponse<ProgressResponseDto>> {
        const progress = await this.progressService.updateFinalComment(dto);
        return {
            success: true,
            message: 'Final comment updated successfully.',
            data: progress,
        };
    }

    @Delete('final-comments')
    async deleteFinalComment(
        @Body() dto: DeleteFinalCommentDto,
    ): Promise<BaseResponse<ProgressResponseDto>> {
        const progress = await this.progressService.deleteFinalComment(dto);
        return {
            success: true,
            message: 'Final comment deleted successfully.',
            data: progress,
        };
    }
}