import {
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
