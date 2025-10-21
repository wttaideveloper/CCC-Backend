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

@Injectable()
export class AssessmentService {
  constructor(
    @InjectModel(Assessment.name)
    private readonly assessmentModel: Model<AssessmentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
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
        status: userAssignment?.status,
        assignedAt: userAssignment?.assignedAt,
        completedAt: userAssignment?.completedAt,
      };
    });
  }

  // Update user assignment status
  async updateAssignmentStatus(
    assessmentId: string,
    userId: string,
    status: string,
  ) {
    const validStatuses = ['assigned', 'in-progress', 'completed'];
    if (!validStatuses.includes(status))
      throw new BadRequestException('Invalid status');

    const result = await this.assessmentModel.findOneAndUpdate(
      {
        _id: assessmentId,
        'assignments.userId': new Types.ObjectId(userId),
      },
      {
        $set: {
          'assignments.$.status': status,
          'assignments.$.completedAt':
            status === 'completed' ? new Date() : null,
        },
      },
      { new: true },
    );

    if (!result)
      throw new NotFoundException('Assignment not found for this user');

    return result;
  }
}
