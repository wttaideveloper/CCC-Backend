import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { VALID_ASSESSMENT_ASSIGNMENT_STATUSES, ASSESSMENT_ASSIGNMENT_STATUSES } from '../../../common/constants/status.constants';

@Schema()
export class UserAnswer {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  sectionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  layerId: Types.ObjectId;

  @Prop()
  selectedChoice: string;

  @Prop({ type: Date, default: Date.now })
  answeredAt: Date;
}

export const UserAnswerSchema = SchemaFactory.createForClass(UserAnswer);

@Schema()
export class Choice {
  @Prop({ required: true })
  text: string;
}
export const ChoiceSchema = SchemaFactory.createForClass(Choice);

@Schema()
export class Layer {
  @Prop({ required: true })
  title: string;

  @Prop({ type: [ChoiceSchema], default: [] })
  choices: Choice[];
}

@Schema()
export class AssignTo {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: VALID_ASSESSMENT_ASSIGNMENT_STATUSES,
    default: ASSESSMENT_ASSIGNMENT_STATUSES.ASSIGNED,
  })
  status: string;

  @Prop({ type: Date, default: Date.now })
  assignedAt: Date;

  @Prop({ type: Date })
  completedAt?: Date;
}

export const AssignmentSchema = SchemaFactory.createForClass(AssignTo);

export const LayerSchema = SchemaFactory.createForClass(Layer);

@Schema()
export class Section {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  bannerImage?: string;

  @Prop({ type: [LayerSchema], default: [] })
  layers: Layer[];
}
export const SectionSchema = SchemaFactory.createForClass(Section);

export type AssessmentDocument = Assessment & Document;

@Schema({ timestamps: true })
export class Assessment {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  instructions: string[];

  @Prop()
  bannerImage?: string;

  @Prop({ type: Types.ObjectId, ref: 'Roadmap', required: false })
  roadmapId: Types.ObjectId;

  @Prop({ type: [SectionSchema], default: [] })
  sections: Section[];

  @Prop({ type: [AssignmentSchema], default: [] })
  assignments: AssignTo[];

  @Prop({ type: [UserAnswerSchema], default: [] })
  userAnswers: UserAnswer[];
}

export const AssessmentSchema = SchemaFactory.createForClass(Assessment);

AssessmentSchema.index({ 'assignments.userId': 1 });
AssessmentSchema.index({ 'assignments.status': 1 });
AssessmentSchema.index({ 'userAnswers.userId': 1 });
AssessmentSchema.index({ 'assignments.userId': 1, 'assignments.status': 1 });
AssessmentSchema.index({ name: 1 });
AssessmentSchema.index({ createdAt: 1 });
AssessmentSchema.index({ 'assignments.status': 1, createdAt: -1 });
