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
import { CreateOrUpdateFormDto } from './dto/micro-grant.dto';

@Injectable()
export class MicroGrantService {
  constructor(
    @InjectModel(MicroGrantForm.name)
    private formModel: Model<MicroGrantFormDocument>,

    @InjectModel(MicroGrantApplication.name)
    private applicationModel: Model<MicroGrantApplicationDocument>,
  ) {}

  async createOrUpdateForm(dto: CreateOrUpdateFormDto) {
    const existingForm = await this.formModel.findOne();

    if (existingForm) {
      existingForm.title = dto.title;
      existingForm.description = dto.description ?? '';
      existingForm.fields = dto.fields.map((f) => ({
        label: f.label,
        type: f.type,
        required: f.required ?? false,
        options: f.options ?? [],
      }));
      await existingForm.save();

      return existingForm;
    }
    const newForm = await this.formModel.create(dto);
    return newForm;
  }

  async getForm() {
    const form = await this.formModel.findOne().sort({ updatedAt: -1 });
    if (!form) throw new NotFoundException('No active form found');
    return form;
  }

  // // Pastor applies for micro grant
  // async applyGrant(pastorId: string, dto: ApplyMicroGrantDto) {
  //   // Check if form exists
  //   const form = await this.formModel.findOne();
  //   if (!form) throw new NotFoundException('No active form found');
  //
  //   if (!dto.amount || dto.amount <= 0) {
  //     throw new BadRequestException('Please enter a valid amount');
  //   }
  //
  //   const application = await this.applicationModel.create({
  //     userId: new Types.ObjectId(pastorId),
  //     formId: form._id,
  //     answers: dto.answers,
  //     supportingDoc: dto.supportingDoc,
  //   });
  //
  //   return application;
  // }
}
