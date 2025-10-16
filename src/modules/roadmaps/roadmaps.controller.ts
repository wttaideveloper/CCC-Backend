import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
} from '@nestjs/common';
import { RoadMapsService } from './roadmaps.service';
import { BaseResponse } from 'src/shared/interfaces/base-response.interface';
import { RoadMapResponseDto, CreateRoadMapDto } from './dto/roadmap.dto';
import { AddCommentDto, CommentsThreadResponseDto } from './dto/comments.dto';
import {
  CreateQueryDto,
  QueriesThreadResponseDto,
  ReplyQueryDto,
} from './dto/queries.dto';

@Controller('roadmaps')
export class RoadMapsController {
  constructor(private readonly roadMapsService: RoadMapsService) {}

  @Post()
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
    @Param('id') id: string,
  ): Promise<BaseResponse<RoadMapResponseDto>> {
    const roadmap = await this.roadMapsService.findById(id);
    return {
      success: true,
      message: 'RoadMap fetched successfully',
      data: roadmap,
    };
  }

  @Post(':roadMapId/comments')
  async addComment(
    @Param('roadMapId') roadMapId: string,
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
    @Param('roadMapId') roadMapId: string,
    @Query('userId') userId: string,
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
    @Param('roadMapId') roadMapId: string,
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
    @Param('roadMapId') roadMapId: string,
    @Query('userId') userId: string,
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
    @Param('roadMapId') roadMapId: string,
    @Param('queryItemId') queryItemId: string,
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
