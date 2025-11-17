import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    Patch,
    Delete,
    UseInterceptors,
    UploadedFile,
    // UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RoadMapsService } from './roadmaps.service';
import { BaseResponse } from 'src/shared/interfaces/base-response.interface';
import { RoadMapResponseDto, CreateRoadMapDto, UpdateRoadMapDto, UpdateNestedRoadMapItemDto, NestedRoadMapItemDto } from './dto/roadmap.dto';
import { AddCommentDto, CommentsThreadResponseDto } from './dto/comments.dto';
import {
    CreateQueryDto,
    QueriesThreadResponseDto,
    ReplyQueryDto,
} from './dto/queries.dto';
import { CreateExtrasDto, UpdateExtrasDto, ExtrasResponseDto, ExtrasDocumentDto } from './dto/extras.dto';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';
// import { ROLES } from '../../common/constants/roles.constants';

@Controller('roadmaps')
// @UseGuards(JwtAuthGuard, RolesGuard)
export class RoadMapsController {
    constructor(private readonly roadMapsService: RoadMapsService) { }

    @Post()
    // @Roles(ROLES.DIRECTOR, ROLES.MENTOR)
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
    // @Roles(ROLES.DIRECTOR, ROLES.MENTOR)
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
    // @Roles(ROLES.DIRECTOR)
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

    @Patch(':roadMapId/nested/:nestedItemId')
    // @Roles(ROLES.DIRECTOR, ROLES.MENTOR)
    async updateNestedRoadMapItem(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Param('nestedItemId', ParseMongoIdPipe) nestedItemId: string,
        @Body() dto: UpdateNestedRoadMapItemDto,
    ): Promise<BaseResponse<RoadMapResponseDto>> {
        const roadmap = await this.roadMapsService.updateNestedRoadMapItem(
            roadMapId,
            nestedItemId,
            dto,
        );
        return {
            success: true,
            message: 'Nested roadmap item updated successfully',
            data: roadmap,
        };
    }

    @Post(':roadMapId/nested')
    // @Roles(ROLES.DIRECTOR, ROLES.MENTOR)
    async addNestedRoadMap(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Body() dto: NestedRoadMapItemDto,
    ): Promise<BaseResponse<RoadMapResponseDto>> {
        const roadmap = await this.roadMapsService.addNestedRoadMap(roadMapId, dto);
        return {
            success: true,
            message: 'Nested RoadMap item added successfully',
            data: roadmap,
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

    @Get(':roadMapId/extras')
    async getExtras(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Query('userId', ParseMongoIdPipe) userId: string,
        @Query('nestedRoadMapItemId') nestedRoadMapItemId?: string,
    ): Promise<BaseResponse<ExtrasResponseDto | null>> {
        const extras = await this.roadMapsService.getExtras(
            roadMapId,
            userId,
            nestedRoadMapItemId,
        );
        return {
            success: true,
            message: extras ? 'Extras fetched successfully' : 'No extras found',
            data: extras,
        };
    }

    @Post(':roadMapId/extras')
    async saveExtras(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Body() dto: CreateExtrasDto,
    ): Promise<BaseResponse<ExtrasResponseDto>> {
        const extras = await this.roadMapsService.saveExtras(roadMapId, dto);
        return {
            success: true,
            message: 'Extras saved successfully',
            data: extras,
        };
    }

    @Patch(':roadMapId/extras')
    async updateExtras(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Query('userId', ParseMongoIdPipe) userId: string,
        @Query('nestedRoadMapItemId') nestedRoadMapItemId: string | undefined,
        @Body() dto: UpdateExtrasDto,
    ): Promise<BaseResponse<ExtrasResponseDto>> {
        const extras = await this.roadMapsService.updateExtras(
            roadMapId,
            userId,
            dto,
            nestedRoadMapItemId,
        );
        return {
            success: true,
            message: 'Extras updated successfully',
            data: extras,
        };
    }

    @Delete(':roadMapId/extras')
    async deleteExtras(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Query('userId', ParseMongoIdPipe) userId: string,
        @Query('nestedRoadMapItemId') nestedRoadMapItemId?: string,
    ): Promise<BaseResponse<{ message: string }>> {
        const result = await this.roadMapsService.deleteExtras(
            roadMapId,
            userId,
            nestedRoadMapItemId,
        );
        return {
            success: true,
            message: 'Extras deleted successfully',
            data: result,
        };
    }

    @Post(':roadMapId/extras/documents')
    @UseInterceptors(FileInterceptor('file'))
    async uploadExtrasDocument(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Query('userId', ParseMongoIdPipe) userId: string,
        @Query('nestedRoadMapItemId', ParseMongoIdPipe) nestedRoadMapItemId: string | undefined,
        @UploadedFile() file: Express.Multer.File,
    ): Promise<BaseResponse<ExtrasDocumentDto>> {
        const document = await this.roadMapsService.uploadExtrasDocument(
            roadMapId,
            userId,
            file,
            nestedRoadMapItemId,
        );
        return {
            success: true,
            message: 'Document uploaded successfully',
            data: document,
        };
    }

    @Get(':roadMapId/extras/documents')
    async getExtrasDocuments(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Query('userId', ParseMongoIdPipe) userId: string,
        @Query('nestedRoadMapItemId') nestedRoadMapItemId?: string,
    ): Promise<BaseResponse<ExtrasDocumentDto[]>> {
        const documents = await this.roadMapsService.getExtrasDocuments(
            roadMapId,
            userId,
            nestedRoadMapItemId,
        );
        return {
            success: true,
            message: 'Documents fetched successfully',
            data: documents,
        };
    }

    @Delete(':roadMapId/extras/documents')
    async deleteExtrasDocument(
        @Param('roadMapId', ParseMongoIdPipe) roadMapId: string,
        @Query('userId', ParseMongoIdPipe) userId: string,
        @Query('fileUrl') fileUrl: string,
        @Query('nestedRoadMapItemId') nestedRoadMapItemId?: string,
    ): Promise<BaseResponse<{ message: string }>> {
        const result = await this.roadMapsService.deleteExtrasDocument(
            roadMapId,
            userId,
            fileUrl,
            nestedRoadMapItemId,
        );
        return {
            success: true,
            message: 'Document deleted successfully',
            data: result,
        };
    }
}
