import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateAssessmentDto } from './dto/assessment.dto';
import { Assessment } from './schemas/assessment.schema';
import { AssessmentService } from './assessment.service.spec';

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
}
