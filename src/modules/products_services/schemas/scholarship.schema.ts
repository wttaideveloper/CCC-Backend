import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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

  @Prop({ enum: ['active', 'completed', 'revoked'], default: 'active' })
  awardStatus: string;
}

const AwardedUserSchema = SchemaFactory.createForClass(AwardedUser);

@Schema({ timestamps: true })
export class Scholarship {
  readonly _id?: Types.ObjectId;

  @Prop({
    required: true,
    enum: [
      'Full Scholarship',
      'Partial Scholarship',
      'Full Cost',
      'Half Scholarship',
      'ADRA Discount',
    ],
    unique: true,
  })
  type: string;

  @Prop({ required: true })
  amount: number;

  @Prop()
  description?: string;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
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
    this.awardedList?.filter((user) => user.awardStatus === 'active').length ||
    0
  );
});

ScholarshipSchema.virtual('totalAmount').get(function (
  this: ScholarshipDocument,
) {
  const activeAwards =
    this.awardedList?.filter((user) => user.awardStatus === 'active').length ||
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
