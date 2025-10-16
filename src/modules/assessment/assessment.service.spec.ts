import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Assessment, AssessmentDocument } from './schemas/assessment.schema';
import { CreateAssessmentDto } from './dto/assessment.dto';

@Injectable()
export class AssessmentService {
  constructor(
    @InjectModel(Assessment.name)
    private readonly assessmentModel: Model<AssessmentDocument>,
  ) {}

  async create(dto: CreateAssessmentDto): Promise<Assessment> {
    const newAssessment = new this.assessmentModel({
      ...dto,
      roadmapId: new Types.ObjectId(dto.roadmapId),
    });
    return newAssessment.save();
  }

  async getAll(): Promise<Assessment[]> {
    return this.assessmentModel.find().populate('roadmapId').exec();
  }

  async getById(id: string): Promise<Assessment> {
    const assessment = await this.assessmentModel
      .findById(id)
      .populate('roadmapId')
      .exec();
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }
}
