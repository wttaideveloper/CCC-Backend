import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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
export const LayerSchema = SchemaFactory.createForClass(Layer);

@Schema()
export class AssignTo {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  assignedAt: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ default: 'assigned' })
  status: string;
}
export const AssignmentSchema = SchemaFactory.createForClass(AssignTo);

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

  @Prop({ type: [SectionSchema], default: [] })
  sections: Section[];

  @Prop({ type: [AssignmentSchema], default: [] })
  assignments: AssignTo[];
}

export const AssessmentSchema = SchemaFactory.createForClass(Assessment);
