import { Controller, Get, Param, Patch, Post, Body } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { Types } from 'mongoose';
import {
    AssignRoadmapDto,
    AssignAssessmentDto,
    UpdateRoadmapProgressDto,
    UpdateAssessmentProgressDto,
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
    ): Promise<BaseResponse<ProgressResponseDto>> {
        const progress = await this.progressService.findByUserId(userId);
        return {
            success: true,
            message: 'User progress fetched successfully.',
            data: progress,
        };
    }

    @Post('assign-roadmap')
    async assignRoadmap(
        @Body() dto: AssignRoadmapDto,
    ): Promise<BaseResponse<ProgressResponseDto>> {
        const progress = await this.progressService.assignRoadmap(dto);
        return {
            success: true,
            message: 'RoadMap assigned and progress record updated.',
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
}