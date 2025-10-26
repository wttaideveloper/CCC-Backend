import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MicroGrantFormDocument = MicroGrantForm & Document;

@Schema({ timestamps: true })
export class MicroGrantForm {
  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({
    type: [
      {
        label: { type: String, required: true },
        type: { type: String, required: true },
        required: { type: Boolean, default: false },
        options: { type: [String], default: [] },
      },
    ],
    default: [],
  })
  fields: {
    label: string;
    type: string;
    required: boolean;
    options?: string[];
  }[];
}

export const MicroGrantFormSchema =
  SchemaFactory.createForClass(MicroGrantForm);
