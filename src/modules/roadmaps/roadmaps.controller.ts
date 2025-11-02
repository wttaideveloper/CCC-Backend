import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    Patch,
    Delete,
    UseGuards,
} from '@nestjs/common';
import { RoadMapsService } from './roadmaps.service';
import { BaseResponse } from 'src/shared/interfaces/base-response.interface';
import { RoadMapResponseDto, CreateRoadMapDto, UpdateRoadMapDto } from './dto/roadmap.dto';
import { AddCommentDto, CommentsThreadResponseDto } from './dto/comments.dto';
import {
    CreateQueryDto,
    QueriesThreadResponseDto,
    ReplyQueryDto,
} from './dto/queries.dto';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles.constants';

@Controller('roadmaps')
@UseGuards(JwtAuthGuard, RolesGuard) // Apply to all routes in this controller
export class RoadMapsController {
    constructor(private readonly roadMapsService: RoadMapsService) { }

    @Post()
    @Roles(ROLES.DIRECTOR, ROLES.MENTOR) // Only directors and mentors can create roadmaps
    async createRoadMap(
        @Body() dto: CreateRoadMapDto,
    ): Promise<BaseResponse<RoadMapResponseDto>> {
        const roadmap = await this.roadMapsService.create(dto);
        return {
            success: true,
            message: 'RoadMap created successfully',
            data: roadmap,
        };
    }

    @Get()
    async getAllRoadmaps(
        @Query('status') status: string = 'all',
        @Query('search') search: string = '',
    ): Promise<BaseResponse<RoadMapResponseDto[]>> {
        const roadmaps = await this.roadMapsService.findAll(status, search);
        return {
            success: true,
            message: 'RoadMaps fetched successfully',
            data: roadmaps,
        };
    }

    // @Get(':id/details')
    // async getRoadMapDetails(@Param('id') id: string): Promise<BaseResponse<any>> {

    //     const result = await this.roadMapsService.getRoadMap(id);
    //     return {
    //         success: true,
    //         message: 'RoadMap details and comments fetched successfully',
    //         data: result,
    //     };
    // }

    @Get(':id')
    async getRoadMapById(
        @Param('id', ParseMongoIdPipe) id: string, // <-- ADDED PIPE FOR CONSISTENCY
    ): Promise<BaseResponse<RoadMapResponseDto>> {
        const roadmap = await this.roadMapsService.findById(id);
        return {
            success: true,
            message: 'RoadMap fetched successfully',
            data: roadmap,
        };
    }

    @Patch(':id')
    @Roles(ROLES.DIRECTOR, ROLES.MENTOR) // Only directors and mentors can update
    async updateRoadMap(
        @Param('id', ParseMongoIdPipe) id: string,
        @Body() dto: UpdateRoadMapDto,
    ): Promise<BaseResponse<RoadMapResponseDto>> {
        const roadmap = await this.roadMapsService.update(id, dto);
        return {
            success: true,
            message: 'RoadMap updated successfully',
            data: roadmap,
        };
    }

    @Delete(':id')
    @Roles(ROLES.DIRECTOR) // Only directors can delete
    async deleteRoadMap(
        @Param('id', ParseMongoIdPipe) id: string,
    ): Promise<BaseResponse<{ _id: string }>> {
        const result = await this.roadMapsService.delete(id);
        return {
            success: true,
            message: 'RoadMap deleted successfully',
            data: result,
        };
    }

    @Post(':roadMapId/comments')
    async addComment(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Body() dto: AddCommentDto,
    ): Promise<BaseResponse<CommentsThreadResponseDto>> {
        const thread = await this.roadMapsService.addComment(roadMapId, dto);
        return {
            success: true,
            message: 'Comment added successfully',
            data: thread,
        };
    }

    @Get(':roadMapId/comments')
    async getCommentThread(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Query('userId', ParseMongoIdPipe) userId: string,
    ): Promise<BaseResponse<CommentsThreadResponseDto>> {
        const thread = await this.roadMapsService.getCommentThread(
            roadMapId,
            userId,
        );
        return {
            success: true,
            message: 'Comment thread fetched successfully',
            data: thread,
        };
    }

    @Post(':roadMapId/queries')
    async addQuery(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Body() dto: CreateQueryDto,
    ): Promise<BaseResponse<QueriesThreadResponseDto>> {
        const thread = await this.roadMapsService.addQuery(roadMapId, dto);
        return {
            success: true,
            message: 'Query added and thread updated successfully',
            data: thread,
        };
    }

    @Get(':roadMapId/queries')
    async getAllQueryThreads(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Query('userId', ParseMongoIdPipe) userId: string,
        @Query('status') status?: string,
    ): Promise<BaseResponse<QueriesThreadResponseDto[]>> {
        const threads = await this.roadMapsService.getAllQueryThreads(
            roadMapId,
            userId,
            status,
        );
        return {
            success: true,
            message: 'Query threads fetched successfully',
            data: threads,
        };
    }

    @Patch(':roadMapId/queries/:queryItemId/reply')
    async replyQuery(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Param('queryItemId', ParseMongoIdPipe) queryItemId: string,
        @Body() dto: ReplyQueryDto,
    ): Promise<BaseResponse<QueriesThreadResponseDto>> {
        const thread = await this.roadMapsService.replyQuery(
            roadMapId,
            queryItemId,
            dto,
        );
        return {
            success: true,
            message: 'Query replied successfully',
            data: thread,
        };
    }
}
