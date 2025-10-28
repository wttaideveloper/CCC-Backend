import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserAnswerDocument = UserAnswer & Document;

@Schema()
export class LayerAnswer {
  @Prop({ type: Types.ObjectId, required: true })
  layerId: Types.ObjectId;

  @Prop({ required: true })
  selectedChoice: string;

  @Prop({ type: Date, default: Date.now })
  answeredAt: Date;
}

export const LayerAnswerSchema = SchemaFactory.createForClass(LayerAnswer);

@Schema()
export class SectionAnswer {
  @Prop({ type: Types.ObjectId, required: true })
  sectionId: Types.ObjectId;

  @Prop({ type: [LayerAnswerSchema], default: [] })
  layers: LayerAnswer[];
}

export const SectionAnswerSchema = SchemaFactory.createForClass(SectionAnswer);

@Schema({ timestamps: true })
export class UserAnswer {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Assessment', required: true })
  assessmentId: Types.ObjectId;

  @Prop({ type: [SectionAnswerSchema], default: [] })
  sections: SectionAnswer[];
}

export const UserAnswerSchema = SchemaFactory.createForClass(UserAnswer);

UserAnswerSchema.index({ userId: 1, assessmentId: 1 });
UserAnswerSchema.index({ assessmentId: 1 });
UserAnswerSchema.index({ userId: 1 });

// UserAnswerSchema.index({ createdAt: -1 });
// UserAnswerSchema.index({ updatedAt: -1 });
