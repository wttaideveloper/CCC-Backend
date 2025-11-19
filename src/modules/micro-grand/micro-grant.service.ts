import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MicroGrantForm,
  MicroGrantFormDocument,
} from './schemas/micro-grant-form.schema';
import {
  MicroGrantApplication,
  MicroGrantApplicationDocument,
} from './schemas/micro-grant-application.schema';
import {
  ApplyMicroGrantDto,
  CreateOrUpdateFormDto,
} from './dto/micro-grant.dto';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class MicroGrantService {
  constructor(
    @InjectModel(MicroGrantForm.name)
    private formModel: Model<MicroGrantFormDocument>,
    @InjectModel(MicroGrantApplication.name)
    private applicationModel: Model<MicroGrantApplicationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) { }

  async createOrUpdateForm(dto: CreateOrUpdateFormDto) {
    const existingForm = await this.formModel
      .findOne()
      .sort({ updatedAt: -1 })
      .exec();

    if (existingForm) {
      const updated = await this.formModel
        .findByIdAndUpdate(
          existingForm._id,
          {
            title: dto.title,
            description: dto.description ?? '',
            fields: dto.fields.map((f) => ({
              label: f.label,
              type: f.type,
              required: f.required ?? false,
              options: f.options ?? [],
            })),
          },
          { new: true }
        )
        .exec();

      return updated;
    }
    const newForm = await this.formModel.create(dto);
    return newForm;
  }

  async getForm() {
    const form = await this.formModel
      .findOne()
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    if (!form) throw new NotFoundException('No active form found');
    return form;
  }

  async applyForGrant(dto: ApplyMicroGrantDto) {
    const form = await this.formModel
      .findOne()
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    if (!form) throw new NotFoundException('No active form available');

    const existing = await this.applicationModel.findOne({
      userId: new Types.ObjectId(dto.userId),
      formId: form._id,
    });

    if (existing) {
      throw new BadRequestException('You have already applied for this grant.');
    }

    const missingRequired = form.fields.filter(
      (f) =>
        f.required &&
        (dto.answers[f.label] === undefined || dto.answers[f.label] === ''),
    );

    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Missing answers for required fields: ${missingRequired
          .map((f) => f.label)
          .join(', ')}`,
      );
    }
    const application = await this.applicationModel.create({
      userId: new Types.ObjectId(dto.userId),
      formId: form._id,
      answers: dto.answers,
      supportingDoc: dto.supportingDoc || '',
    });

    return application;
  }

  async getApplications(status?: string, search?: string) {
    const query: any = {};

    if (status) query.status = status;

    if (search) {
      query['$or'] = [
        { 'answers.Church Name': new RegExp(search, 'i') },
        { 'answers.Purpose of Grant': new RegExp(search, 'i') },
      ];
    }

    const applications = await this.applicationModel
      .find(query)
      .populate('userId', 'name email')
      .populate('formId', 'title')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return applications;
  }

  async getUserApplication(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID format');
    }

    const user = await this.userModel
      .findById(userId)
      .select('name email role profileImage')
      .lean()
      .exec();

    const query = { userId: new Types.ObjectId(userId) };

    const application = await this.applicationModel
      .findOne(query)
      .populate('formId', 'title description')
      .lean()
      .exec();

    if (!application)
      throw new NotFoundException('Application not found for this user');

    return { user, application };
  }

  async updateApplicationStatus(id: string, status: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid application ID');
    }

    const application = await this.applicationModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return {
      message: `Application status updated to ${status}`,
      application,
    };
  }

  async checkApplication(userId: string) {
    const application = await this.applicationModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean();

    if (!application) {
      return {
        applied: false,
        status: "not_applied"
      };
    }

    return {
      applied: true,
      status: application.status,
      applicationId: application._id,
    };
  }
}
