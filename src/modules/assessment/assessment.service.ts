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
import { ASSESSMENT_ASSIGNMENT_STATUSES } from '../../common/constants/status.constants';
import { UserAnswer } from './schemas/answer.schema';
import { SubmitSectionAnswersDto } from './dto/submit-section-answers.dto';
import { SubmitPreSurveyDto } from './dto/submit-pre-survey.dto';

@Injectable()
export class AssessmentService {
  constructor(
    @InjectModel(Assessment.name)
    private readonly assessmentModel: Model<AssessmentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(UserAnswer.name)
    private readonly userAnswerModel: Model<UserAnswer>,
  ) { }

  async create(dto: CreateAssessmentDto): Promise<Assessment> {
    const newAssessment = await this.assessmentModel.create({
      ...dto,
      roadmapId: dto.roadmapId ? new Types.ObjectId(dto.roadmapId) : undefined,
    });
    return newAssessment;
  }

  async getAll(): Promise<Assessment[]> {
    return this.assessmentModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async getById(id: string): Promise<Assessment> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid assessment ID format');
    }

    const assessment = await this.assessmentModel
      .findById(id)
      .lean()
      .exec();
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async deleteAssessment(id: string): Promise<AssessmentDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid assessment ID format');
    }
    return this.assessmentModel.findByIdAndDelete(id).exec();
  }

  async updateInstructions(
    id: string,
    instructions: string[],
  ): Promise<Assessment> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid assessment ID format');
    }

    const assessment = await this.assessmentModel
      .findByIdAndUpdate(id, { instructions }, { new: true })
      .lean()
      .exec();
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async updateSections(
    id: string,
    sections: SectionDto[],
  ): Promise<Assessment> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid assessment ID format');
    }

    const assessment = await this.assessmentModel
      .findByIdAndUpdate(id, { sections }, { new: true })
      .lean()
      .exec();
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  // Assign assessment to multiple users
  async assignAssessmentToUsers(assessmentId: string, userIds: string[]) {
    if (!Types.ObjectId.isValid(assessmentId)) {
      throw new BadRequestException('Invalid assessment ID format');
    }

    const invalidIds = userIds.filter((id) => !Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid user IDs: ${invalidIds.join(', ')}`);
    }

    const assessment = await this.assessmentModel.findById(assessmentId).exec();
    if (!assessment) throw new NotFoundException('Assessment not found');

    const validUsers = await this.userModel
      .find({
        _id: { $in: userIds.map((id) => new Types.ObjectId(id)) },
      })
      .select('_id')
      .lean()
      .exec();

    if (validUsers.length === 0) {
      throw new BadRequestException('No valid users found');
    }

    const alreadyAssignedIds = new Set(
      assessment.assignments.map((a) => a.userId.toString()),
    );
    const newUsers = validUsers.filter(
      (user) => !alreadyAssignedIds.has(user._id.toString()),
    );

    if (newUsers.length === 0) {
      throw new BadRequestException('All users are already assigned to this assessment');
    }

    const newAssignments = newUsers.map((user) => ({
      userId: user._id,
      status: ASSESSMENT_ASSIGNMENT_STATUSES.ASSIGNED,
      assignedAt: new Date(),
    }));

    const updated = await this.assessmentModel
      .findByIdAndUpdate(
        assessmentId,
        { $push: { assignments: { $each: newAssignments } } },
        { new: true },
      )
      .lean()
      .exec();

    return updated;
  }

  // Get all assessments assigned to a specific user
  async getAssignedAssessments(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const userObjectId = new Types.ObjectId(userId);
    const assessments = await this.assessmentModel
      .find({
        'assignments.userId': userObjectId,
      })
      .select('_id name description bannerImage instructions assignments')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

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
    if (!Types.ObjectId.isValid(assessmentId)) {
      throw new BadRequestException('Invalid assessment ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }
    if (!Types.ObjectId.isValid(sectionId)) {
      throw new BadRequestException('Invalid section ID format');
    }

    const invalidLayerIds = layers.filter((layer) => !Types.ObjectId.isValid(layer.layerId));
    if (invalidLayerIds.length > 0) {
      throw new BadRequestException('Invalid layer IDs found');
    }

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
    )
      .lean()
      .exec();

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
    )
      .lean()
      .exec();

    return result;
  }

  // Get all saved answers for a user
  async getUserAnswers(assessmentId: string, userId: string) {
    if (!Types.ObjectId.isValid(assessmentId)) {
      throw new BadRequestException('Invalid assessment ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const result = await this.userAnswerModel
      .findOne({
        assessmentId: new Types.ObjectId(assessmentId),
        userId: new Types.ObjectId(userId),
      })
      .lean()
      .exec();

    if (!result)
      throw new NotFoundException(
        'No answers found for this user and assessment',
      );

    return result;
  }

  // Submit Pre-Survey Answers
  async submitPreSurvey(assessmentId: string, dto: SubmitPreSurveyDto) {
    const { userId, preSurveyAnswers } = dto;

    if (!Types.ObjectId.isValid(assessmentId)) {
      throw new BadRequestException('Invalid assessment ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // Validate the assessment
    const assessment = await this.assessmentModel.findById(assessmentId).lean();
    if (!assessment) throw new NotFoundException('Assessment not found');

    // Ensure it's a CMA-type assessment
    if (assessment.type !== 'CMA') {
      throw new BadRequestException('PreSurvey is only applicable for CMA assessments');
    }

    // Ensure preSurvey questions exist in the assessment
    if (!assessment.preSurvey || assessment.preSurvey.length === 0) {
      throw new BadRequestException('This assessment has no pre-survey questions');
    }

    // Optional: Validate answers match defined questions
    const questionTexts = assessment.preSurvey.map(q => q.text);
    for (const answer of preSurveyAnswers) {
      if (!questionTexts.includes(answer.questionText)) {
        throw new BadRequestException(`Invalid question: ${answer.questionText}`);
      }
    }

    const updated = await this.userAnswerModel.findOneAndUpdate(
      {
        assessmentId: new Types.ObjectId(assessmentId),
        userId: new Types.ObjectId(userId),
      },
      {
        $set: {
          preSurveyAnswers,
          preSurveySubmittedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    ).lean().exec();

    return updated;
  }



  // Get Pre-Survey Answers for a User
  async getPreSurveyAnswers(assessmentId: string, userId: string) {
    if (!Types.ObjectId.isValid(assessmentId)) {
      throw new BadRequestException('Invalid assessment ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const assessment = await this.assessmentModel.findById(assessmentId).lean();
    if (!assessment) throw new NotFoundException('Assessment not found');

    if (assessment.type !== 'CMA') {
      throw new BadRequestException('PreSurvey is only applicable for CMA assessments');
    }

    const userAnswers = await this.userAnswerModel
      .findOne({
        assessmentId: new Types.ObjectId(assessmentId),
        userId: new Types.ObjectId(userId),
      })
      .lean()
      .exec();

    if (!userAnswers || !userAnswers.preSurveyAnswers?.length) {
      return {
        preSurveyAnswers: [],
        preSurveySubmittedAt: null,
        totalQuestions: assessment.preSurvey?.length || 0,
      };
    }

    return {
      preSurveyAnswers: userAnswers.preSurveyAnswers,
      preSurveySubmittedAt: userAnswers.preSurveySubmittedAt,
      totalQuestions: assessment.preSurvey?.length || 0,
    };
  }


  // Submit Section Answers
  async submitSectionAnswers(assessmentId: string, dto: SubmitSectionAnswersDto) {
    const { userId, answers } = dto;

    if (!Types.ObjectId.isValid(assessmentId)) {
      throw new BadRequestException('Invalid assessment ID format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const assessment = await this.assessmentModel.findById(assessmentId).lean();
    if (!assessment) throw new NotFoundException('Assessment not found');

    const sectionEntries = answers.map((section) => ({
      sectionId: new Types.ObjectId(section.sectionId),
      layers: section.layers.map((layer) => ({
        layerId: new Types.ObjectId(layer.layerId),
        selectedChoice: layer.selectedChoice,
        answeredAt: new Date(),
      })),
    }));

    const updated = await this.userAnswerModel.findOneAndUpdate(
      {
        assessmentId: new Types.ObjectId(assessmentId),
        userId: new Types.ObjectId(userId),
      },
      {
        $set: {
          sections: sectionEntries,
          submittedAt: new Date(),
        },
      },
      { new: true, upsert: true },
    );

    return updated;
  }
}