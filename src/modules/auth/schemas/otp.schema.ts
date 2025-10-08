import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpDocument = OtpToken & Document;

@Schema({ timestamps: true })
export class OtpToken {
    @Prop({ required: true })
    email: string;

    @Prop({ required: true })
    otpHash: string;

    @Prop({ required: true })
    purpose: string;

    @Prop({ type: Date, required: true })
    expiresAt: Date;

    @Prop({ default: false })
    used: boolean;
}

export const OtpTokenSchema = SchemaFactory.createForClass(OtpToken);
