import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateAssessmentDto, SectionDto } from './dto/assessment.dto';
import { Assessment } from './schemas/assessment.schema';
import { AssessmentService } from './assessment.service';

@Controller('assessment')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Post()
  async create(@Body() dto: CreateAssessmentDto): Promise<Assessment> {
    return this.assessmentService.create(dto);
  }

  @Get()
  async getAll(): Promise<Assessment[]> {
    return this.assessmentService.getAll();
  }

  // Assign assessment to multiple users
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

  // Get all assessments assigned to a specific user
  @Get('assigned/:userId')
  async getAssignedAssessments(@Param('userId') userId: string) {
    const result = await this.assessmentService.getAssignedAssessments(userId);
    return {
      success: true,
      message: 'Assigned assessments fetched successfully',
      data: result,
    };
  }

  // Update user assignment status
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

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Assessment> {
    return this.assessmentService.getById(id);
  }

  @Delete(':id')
  async deleteAssessment(@Param('id') id: string) {
    const deleted = await this.assessmentService.deleteAssessment(id);
    if (!deleted) {
      throw new NotFoundException('Assessment not found');
    }
    return { message: 'Assessment deleted successfully' };
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
}
