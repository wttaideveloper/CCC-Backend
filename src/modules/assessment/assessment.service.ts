import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Assessment, AssessmentDocument } from './schemas/assessment.schema';
import { CreateAssessmentDto, SectionDto } from './dto/assessment.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserAnswer } from './schemas/answer.schema';

@Injectable()
export class AssessmentService {
  constructor(
    @InjectModel(Assessment.name)
    private readonly assessmentModel: Model<AssessmentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(UserAnswer.name)
    private readonly userAnswerModel: Model<UserAnswer>,
  ) {}

  async create(dto: CreateAssessmentDto): Promise<Assessment> {
    const newAssessment = new this.assessmentModel({
      ...dto,
      roadmapId: dto.roadmapId ? new Types.ObjectId(dto.roadmapId) : undefined,
    });
    return newAssessment.save();
  }

  async getAll(): Promise<Assessment[]> {
    return this.assessmentModel.find().exec();
  }

  async getById(id: string): Promise<Assessment> {
    const assessment = await this.assessmentModel.findById(id).exec();
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

  // Assign assessment to multiple users
  async assignAssessmentToUsers(assessmentId: string, userIds: string[]) {
    const assessment = await this.assessmentModel.findById(assessmentId);
    if (!assessment) throw new NotFoundException('Assessment not found');

    const validUsers = await this.userModel.find({
      _id: { $in: userIds.map((id) => new Types.ObjectId(id)) },
    });

    if (validUsers.length === 0)
      throw new BadRequestException('No valid users found');

    const newAssignments = validUsers.map((user) => ({
      userId: user._id,
      status: 'assigned',
      assignedAt: new Date(),
    }));

    assessment.assignments.push(...newAssignments);
    await assessment.save();

    return assessment;
  }

  // Get all assessments assigned to a specific user
  async getAssignedAssessments(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const assessments = await this.assessmentModel.find({
      'assignments.userId': userObjectId,
    });

    return assessments.map((a) => {
      const userAssignment = a.assignments.find(
        (x) => x.userId.toString() === userId,
      );
      return {
        _id: a._id,
        name: a.name,
        description: a.description,
        bannerImage: a.bannerImage,
        instructions: a.instructions,
        assignedAt: userAssignment?.assignedAt,
        completedAt: userAssignment?.completedAt,
      };
    });
  }
  // Save or update answers for one section
  async saveOrUpdateSectionAnswers(
    assessmentId: string,
    userId: string,
    sectionId: string,
    layers: { layerId: string; selectedChoice: string }[],
  ) {
    const assessmentExists = await this.assessmentModel.exists({
      _id: assessmentId,
    });
    if (!assessmentExists) throw new NotFoundException('Assessment not found');

    const layerAnswers = layers.map((layer) => ({
      layerId: new Types.ObjectId(layer.layerId),
      selectedChoice: layer.selectedChoice,
      answeredAt: new Date(),
    }));

    // Try updating existing section
    const updated = await this.userAnswerModel.findOneAndUpdate(
      {
        assessmentId: new Types.ObjectId(assessmentId),
        userId: new Types.ObjectId(userId),
        'sections.sectionId': new Types.ObjectId(sectionId),
      },
      {
        $set: {
          'sections.$.layers': layerAnswers,
        },
      },
      { new: true },
    );

    if (updated) return updated;

    // If section doesn't exist yet, push a new one
    const result = await this.userAnswerModel.findOneAndUpdate(
      {
        assessmentId: new Types.ObjectId(assessmentId),
        userId: new Types.ObjectId(userId),
      },
      {
        $setOnInsert: {
          assessmentId: new Types.ObjectId(assessmentId),
          userId: new Types.ObjectId(userId),
        },
        $push: {
          sections: {
            sectionId: new Types.ObjectId(sectionId),
            layers: layerAnswers,
          },
        },
      },
      { upsert: true, new: true },
    );

    return result;
  }

  // Get all saved answers for a user
  async getUserAnswers(assessmentId: string, userId: string) {
    const result = await this.userAnswerModel
      .findOne({
        assessmentId: new Types.ObjectId(assessmentId),
        userId: new Types.ObjectId(userId),
      })
      .lean();

    if (!result)
      throw new NotFoundException(
        'No answers found for this user and assessment',
      );

    return result;
  }
}
