import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Assessment, AssessmentDocument } from './schemas/assessment.schema';
import { CreateAssessmentDto, SectionDto } from './dto/assessment.dto';

@Injectable()
export class AssessmentService {
  constructor(
    @InjectModel(Assessment.name)
    private readonly assessmentModel: Model<AssessmentDocument>,
  ) {}

  async create(dto: CreateAssessmentDto): Promise<Assessment> {
    const newAssessment = new this.assessmentModel({
      ...dto,
      roadmapId: dto.roadmapId ? new Types.ObjectId(dto.roadmapId) : undefined,
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

  async deleteAssessment(id: string): Promise<AssessmentDocument | null> {
    return this.assessmentModel.findByIdAndDelete(id).exec();
  }

  async updateInstructions(
    id: string,
    instructions: string[],
  ): Promise<Assessment> {
    const assessment = await this.assessmentModel
      .findByIdAndUpdate(id, { instructions }, { new: true })
      .exec();
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async updateSections(
    id: string,
    sections: SectionDto[],
  ): Promise<Assessment> {
    const assessment = await this.assessmentModel
      .findByIdAndUpdate(id, { sections }, { new: true })
      .exec();
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }
}
