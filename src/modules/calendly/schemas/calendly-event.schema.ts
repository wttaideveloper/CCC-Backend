import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CalendlyEventDocument = CalendlyEventLog & Document;

@Schema({ timestamps: true, collection: 'calendly_events' })
export class CalendlyEventLog {
    @Prop({ type: String, required: true, index: true })
    eventType: string;

    @Prop({ type: String, required: true, unique: true, index: true })
    calendlyEventUri: string;

    @Prop({ type: String, index: true })
    calendlyInviteeUri?: string;

    @Prop({ type: Types.ObjectId, ref: 'Appointment', index: true })
    appointmentId?: Types.ObjectId;

    @Prop({ type: Object, required: true })
    rawPayload: Record<string, any>;

    @Prop({ type: String, enum: ['received', 'processed', 'failed'], default: 'received', index: true })
    status: string;

    @Prop({ type: String })
    errorMessage?: string;

    @Prop({ type: Date, default: Date.now })
    receivedAt: Date;

    @Prop({ type: Date })
    processedAt?: Date;
}

export const CalendlyEventSchema = SchemaFactory.createForClass(CalendlyEventLog);

CalendlyEventSchema.index({ eventType: 1, status: 1 });
CalendlyEventSchema.index({ calendlyEventUri: 1, calendlyInviteeUri: 1 });
CalendlyEventSchema.index({ createdAt: -1 });
