import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MicroGrantApplicationDocument = MicroGrantApplication & Document;

@Schema({ timestamps: true })
export class MicroGrantApplication {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'MicroGrantForm', required: true })
  formId: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  answers: Record<string, any>;

  @Prop()
  supportingDoc: string;

  @Prop({ type: String, enum: ['new', 'pending', 'accepted'], default: 'new' })
  status: string;
}

export const MicroGrantApplicationSchema = SchemaFactory.createForClass(
  MicroGrantApplication,
);
