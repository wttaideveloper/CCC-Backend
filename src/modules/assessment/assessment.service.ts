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
  ) { }

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

  // Start an assessment (sets status = "in-progress")
  async startAssessment(assessmentId: string, userId: string) {
    const result = await this.assessmentModel.findOneAndUpdate(
      {
        _id: assessmentId,
        'assignments.userId': new Types.ObjectId(userId),
      },
      {
        $set: {
          'assignments.$.status': 'in-progress',
        },
      },
      { new: true },
    );

    if (!result)
      throw new NotFoundException(
        'Assessment not found or not assigned to this user',
      );
    return result;
  }

  // Save all user's answers at once (called on submission)
  async saveAnswers(
    assessmentId: string,
    userId: string,
    answers: {
      sectionId: string;
      layerId: string;
      selectedChoice: string;
    }[],
  ) {
    const assessment = await this.assessmentModel.findById(assessmentId);
    if (!assessment) throw new NotFoundException('Assessment not found');

    const userAssigned = assessment.assignments.find(
      (a) => a.userId.toString() === userId,
    );
    if (!userAssigned)
      throw new BadRequestException('User not assigned to this assessment');

    assessment.userAnswers = assessment.userAnswers.filter(
      (a) => a.userId.toString() !== userId,
    );

    const formattedAnswers = answers.map((ans) => ({
      userId: new Types.ObjectId(userId),
      sectionId: new Types.ObjectId(ans.sectionId),
      layerId: new Types.ObjectId(ans.layerId),
      selectedChoice: ans.selectedChoice,
      answeredAt: new Date(),
    }));

    assessment.userAnswers.push(...formattedAnswers);

    await assessment.save();
    return { assessmentId, userId, answersCount: answers.length };
  }

  // Submit assessment and marks completed
  async submitAssessment(
    assessmentId: string,
    userId: string,
    answers?: { sectionId: string; layerId: string; selectedChoice: string }[],
  ) {
    const assessment = await this.assessmentModel.findById(assessmentId);
    if (!assessment) throw new NotFoundException('Assessment not found');

    const userAssigned = assessment.assignments.find(
      (a) => a.userId.toString() === userId,
    );
    if (!userAssigned)
      throw new BadRequestException('User not assigned to this assessment');

    if (answers && answers.length > 0) {
      await this.saveAnswers(assessmentId, userId, answers);
    }

    const result = await this.assessmentModel.findOneAndUpdate(
      {
        _id: assessmentId,
        'assignments.userId': new Types.ObjectId(userId),
      },
      {
        $set: {
          'assignments.$.status': 'completed',
          'assignments.$.completedAt': new Date(),
        },
      },
      { new: true },
    );

    return { message: 'Assessment submitted successfully', data: result };
  }

  // Get user answers for a specific assessment
  async getUserAnswers(assessmentId: string, userId: string) {
    const assessment = await this.assessmentModel
      .findById(assessmentId)
      .select('userAnswers sections name')
      .lean();

    if (!assessment) throw new NotFoundException('Assessment not found');

    const answers = assessment.userAnswers.filter(
      (a) => a.userId.toString() === userId,
    );

    return {
      name: assessment.name,
      sections: assessment.sections,
      answers,
    };
  }
}
