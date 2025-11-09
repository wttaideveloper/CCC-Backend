import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
  // UseGuards,
} from '@nestjs/common';
import { CreateAssessmentDto, SectionDto } from './dto/assessment.dto';
import { Assessment } from './schemas/assessment.schema';
import { AssessmentService } from './assessment.service';
// import { JwtAuthGuard, RolesGuard } from '../../common/guards';
// import { ROLES } from '../../common/constants/roles.constants';
// import { Roles } from '../../common/decorators';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';

@Controller('assessment')
// @UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Post()
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAssessmentDto): Promise<Assessment> {
    return this.assessmentService.create(dto);
  }

  @Get()
  async getAll(): Promise<Assessment[]> {
    return this.assessmentService.getAll();
  }

  @Get(':id')
  async getById(
    @Param('id', ParseMongoIdPipe) id: string,
  ): Promise<Assessment> {
    return this.assessmentService.getById(id);
  }

  @Delete(':id')
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR)
  async deleteAssessment(@Param('id', ParseMongoIdPipe) id: string) {
    const deleted = await this.assessmentService.deleteAssessment(id);
    if (!deleted) throw new NotFoundException('Assessment not found');
    return { success: true, message: 'Assessment deleted successfully' };
  }

  @Patch(':id/instructions')
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR)
  async updateInstructions(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body('instructions') instructions: string[],
  ): Promise<Assessment> {
    return this.assessmentService.updateInstructions(id, instructions);
  }

  @Patch(':id/sections')
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR)
  async updateSections(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body('sections') sections: SectionDto[],
  ): Promise<Assessment> {
    return this.assessmentService.updateSections(id, sections);
  }

  @Post(':assessmentId/assign')
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR)
  async assignAssessment(
    @Param('assessmentId', ParseMongoIdPipe) assessmentId: string,
    @Body('userIds') userIds: string[],
  ) {
    const result = await this.assessmentService.assignAssessmentToUsers(
      assessmentId,
      userIds,
    );
    return {
      success: true,
      message: 'Assessment assigned successfully',
      data: result,
    };
  }

  @Get('assigned/:userId')
  async getAssignedAssessments(
    @Param('userId', ParseMongoIdPipe) userId: string,
  ) {
    const result = await this.assessmentService.getAssignedAssessments(userId);
    return {
      success: true,
      message: 'Assigned assessments fetched successfully',
      data: result,
    };
  }

  // Save or update answers for a single section
  @Post(':assessmentId/section/:userId')
  async saveSectionAnswers(
    @Param('assessmentId') assessmentId: string,
    @Param('userId', ParseMongoIdPipe) userId: string,
    @Body()
    body: {
      sectionId: string;
      layers: { layerId: string; selectedChoice: string }[];
    },
  ) {
    const result = await this.assessmentService.saveOrUpdateSectionAnswers(
      assessmentId,
      userId,
      body.sectionId,
      body.layers,
    );

    return {
      success: true,
      message: 'Section answers saved successfully',
      data: result,
    };
  }

  // Fetch user’s saved answers
  @Get(':assessmentId/answers/:userId')
  async getUserAnswers(
    @Param('assessmentId', ParseMongoIdPipe) assessmentId: string,
    @Param('userId', ParseMongoIdPipe) userId: string,
  ) {
    const result = await this.assessmentService.getUserAnswers(
      assessmentId,
      userId,
    );

    return {
      success: true,
      message: 'User answers fetched successfully',
      data: result,
    };
  }
}
