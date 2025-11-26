import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InterestFormFieldsDocument = Document<unknown, {}, InterestFormFields> &
    InterestFormFields & {
        _id: Types.ObjectId;
    };

export const FIELD_TYPES = {
    TEXT_FIELD: 'text_field',
    TEXT_AREA: 'text_area',
    CHECKBOX: 'checkbox',
    RADIO: 'radio',
    SELECT: 'select',
    EMAIL: 'email',
    PHONE: 'phone',
    DATE: 'date',
    NUMBER: 'number',
} as const;

export const VALID_FIELD_TYPES = Object.values(FIELD_TYPES);

@Schema({ _id: false })
export class DynamicField {
    @Prop({ required: true })
    fieldId: string;

    @Prop({ required: true })
    label: string;

    @Prop({ required: true, enum: VALID_FIELD_TYPES })
    type: string;

    @Prop()
    placeholder?: string;

    @Prop({ default: false })
    required: boolean;

    @Prop({ type: [String], default: [] })
    options: string[]; // For radio, checkbox, select

    @Prop({ default: 0 })
    order: number;

    @Prop()
    section?: string;
}

export const DynamicFieldSchema = SchemaFactory.createForClass(DynamicField);

@Schema({ timestamps: true })
export class InterestFormFields {
    @Prop({ type: [DynamicFieldSchema], default: [] })
    fields: DynamicField[];

    @Prop({ type: Types.ObjectId, ref: 'User' })
    updatedBy?: Types.ObjectId;
}

export const InterestFormFieldsSchema = SchemaFactory.createForClass(InterestFormFields);
