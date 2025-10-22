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
} from '@nestjs/common';
import { CreateAssessmentDto, SectionDto } from './dto/assessment.dto';
import { Assessment } from './schemas/assessment.schema';
import { AssessmentService } from './assessment.service';

@Controller('assessment')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAssessmentDto): Promise<Assessment> {
    return this.assessmentService.create(dto);
  }

  @Get()
  async getAll(): Promise<Assessment[]> {
    return this.assessmentService.getAll();
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Assessment> {
    return this.assessmentService.getById(id);
  }

  @Delete(':id')
  async deleteAssessment(@Param('id') id: string) {
    const deleted = await this.assessmentService.deleteAssessment(id);
    if (!deleted) throw new NotFoundException('Assessment not found');
    return { success: true, message: 'Assessment deleted successfully' };
  }

  @Patch(':id/instructions')
  async updateInstructions(
    @Param('id') id: string,
    @Body('instructions') instructions: string[],
  ): Promise<Assessment> {
    return this.assessmentService.updateInstructions(id, instructions);
  }

  @Patch(':id/sections')
  async updateSections(
    @Param('id') id: string,
    @Body('sections') sections: SectionDto[],
  ): Promise<Assessment> {
    return this.assessmentService.updateSections(id, sections);
  }

  @Post(':assessmentId/assign')
  async assignAssessment(
    @Param('assessmentId') assessmentId: string,
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
  async getAssignedAssessments(@Param('userId') userId: string) {
    const result = await this.assessmentService.getAssignedAssessments(userId);
    return {
      success: true,
      message: 'Assigned assessments fetched successfully',
      data: result,
    };
  }

  @Patch(':assessmentId/status/:userId')
  async updateAssignmentStatus(
    @Param('assessmentId') assessmentId: string,
    @Param('userId') userId: string,
    @Body('status') status: string,
  ) {
    const result = await this.assessmentService.updateAssignmentStatus(
      assessmentId,
      userId,
      status,
    );
    return {
      success: true,
      message: 'Assignment status updated successfully',
      data: result,
    };
  }

  // Start assessment
  @Patch(':assessmentId/start/:userId')
  async startAssessment(
    @Param('assessmentId') assessmentId: string,
    @Param('userId') userId: string,
  ) {
    const result = await this.assessmentService.startAssessment(
      assessmentId,
      userId,
    );
    return {
      success: true,
      message: 'Assessment started successfully',
      data: result,
    };
  }

  @Patch(':assessmentId/submit')
  async submitAssessmentWithAnswers(
    @Param('assessmentId') assessmentId: string,
    @Body()
    body: {
      userId: string;
      answers: {
        sectionId: string;
        layerId: string;
        selectedChoice: string;
      }[];
    },
  ) {
    const result = await this.assessmentService.submitAssessment(
      assessmentId,
      body.userId,
      body.answers,
    );
    return {
      success: true,
      message: 'Assessment submitted successfully',
      data: result,
    };
  }

  // Get user’s answers for a specific assessment
  @Get(':assessmentId/answers/:userId')
  async getUserAnswers(
    @Param('assessmentId') assessmentId: string,
    @Param('userId') userId: string,
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
