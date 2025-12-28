import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MicroGrantFormDocument = MicroGrantForm & Document;

@Schema({ timestamps: true })
export class MicroGrantForm {
  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description?: string;

  @Prop({
    type: [
      {
        section_title: { type: String, required: true },
        section_intro: { type: String, default: '' },
        reportingProcedure: { type: String, default: '' },
        fields: [
          {
            label: { type: String, required: true },
            type: { type: String, required: true },
            description: { type: String, default: '' },
            placeholder: { type: String, default: '' },
            required: { type: Boolean, default: false },
            options: { type: [String], default: [] },
          },
        ],
      },
    ],
    default: [],
  })
  sections: {
    section_title: string;
    section_intro?: string;
    reportingProcedure?: string;
    fields: {
      label: string;
      type: string;
      description?: string;
      placeholder?: string;
      required?: boolean;
      options?: string[];
    }[];
  }[];
}

export const MicroGrantFormSchema =
  SchemaFactory.createForClass(MicroGrantForm);

MicroGrantFormSchema.index({ createdAt: -1 });
MicroGrantFormSchema.index({ updatedAt: -1 });
