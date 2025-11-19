import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { VALID_USER_APPLICATION_STATUSES, USER_APPLICATION_STATUSES } from '../../../common/constants/status.constants';

export type MicroGrantApplicationDocument = MicroGrantApplication & Document;

@Schema({ timestamps: true })
export class MicroGrantApplication {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'MicroGrantForm', required: true })
  formId: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  answers: Record<string, any>;

  @Prop({ type: [String], default: [] })
  supportingDocs: string[];

  @Prop({
    type: String,
    enum: VALID_USER_APPLICATION_STATUSES,
    default: USER_APPLICATION_STATUSES.NEW,
  })
  status: string;
}

export const MicroGrantApplicationSchema = SchemaFactory.createForClass(
  MicroGrantApplication,
);

MicroGrantApplicationSchema.index({ userId: 1 });
MicroGrantApplicationSchema.index({ formId: 1 });
MicroGrantApplicationSchema.index({ status: 1 });
MicroGrantApplicationSchema.index({ userId: 1, status: 1 });
MicroGrantApplicationSchema.index({ createdAt: -1 });
MicroGrantApplicationSchema.index({ updatedAt: -1 });
