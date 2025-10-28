import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { VALID_SCHOLARSHIP_TYPES, VALID_SCHOLARSHIP_STATUSES, SCHOLARSHIP_STATUSES, VALID_AWARD_STATUSES, AWARD_STATUSES } from '../../../common/constants/status.constants';

export type ScholarshipDocument = Document<unknown, {}, Scholarship> &
  Scholarship & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

@Schema()
export class AwardedUser {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  awardedDate: Date;

  @Prop()
  notes?: string;

  @Prop()
  academicYear?: string;

  @Prop({ enum: VALID_AWARD_STATUSES, default: AWARD_STATUSES.ACTIVE })
  awardStatus: string;
}

const AwardedUserSchema = SchemaFactory.createForClass(AwardedUser);

@Schema({ timestamps: true })
export class Scholarship {
  readonly _id?: Types.ObjectId;

  @Prop({
    required: true,
    enum: VALID_SCHOLARSHIP_TYPES,
    unique: true,
  })
  type: string;

  @Prop({ required: true })
  amount: number;

  @Prop()
  description?: string;

  @Prop({ enum: VALID_SCHOLARSHIP_STATUSES, default: SCHOLARSHIP_STATUSES.ACTIVE })
  status: string;

  @Prop({ type: [AwardedUserSchema], default: [] })
  awardedList: AwardedUser[];

  numberOfAwards?: number;
  totalAmount?: number;
}

export const ScholarshipSchema = SchemaFactory.createForClass(Scholarship);

ScholarshipSchema.virtual('numberOfAwards').get(function (
  this: ScholarshipDocument,
) {
  return (
    this.awardedList?.filter((user) => user.awardStatus === AWARD_STATUSES.ACTIVE).length ||
    0
  );
});

ScholarshipSchema.virtual('totalAmount').get(function (
  this: ScholarshipDocument,
) {
  const activeAwards =
    this.awardedList?.filter((user) => user.awardStatus === AWARD_STATUSES.ACTIVE).length ||
    0;
  return this.amount * activeAwards;
});

ScholarshipSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    const { __v, ...rest } = ret;
    return rest;
  },
});

ScholarshipSchema.set('toObject', {
  virtuals: true,
});

ScholarshipSchema.index({ status: 1 });
ScholarshipSchema.index({ type: 1, status: 1 });
ScholarshipSchema.index({ 'awardedList.userId': 1 });
ScholarshipSchema.index({ createdAt: 1 });
ScholarshipSchema.index({ updatedAt: -1 });
