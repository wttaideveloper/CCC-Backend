import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { VALID_APPOINTMENT_STATUSES, VALID_APPOINTMENT_PLATFORMS, APPOINTMENT_STATUSES, APPOINTMENT_PLATFORMS } from '../../../common/constants/status.constants';

export type AppointmentDocument = Document<unknown, {}, Appointment> & Appointment & {
    _id: Types.ObjectId;
};

@Schema({
    timestamps: true,
    collection: 'appointments'
})
export class Appointment {

    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    })
    userId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    })
    mentorId: Types.ObjectId;

    @Prop({
        type: Date,
        required: true
    })
    meetingDate: Date;

    @Prop({
        type: Date,
        required: true,
        default: () => {
            const date = new Date();
            date.setHours(date.getHours() + 1);
            return date;
        }
    })
    endTime: Date;

    @Prop({
        type: String,
        enum: VALID_APPOINTMENT_PLATFORMS,
        default: APPOINTMENT_PLATFORMS.TEAMS,
        required: true
    })
    platform: string;

    @Prop()
    meetingLink?: string;

    @Prop()
    notes?: string;

    @Prop({
        type: String,
        enum: VALID_APPOINTMENT_STATUSES,
        default: APPOINTMENT_STATUSES.SCHEDULED,
        required: true
    })
    status: string;

    @Prop({ type: Date, default: null })
    canceledAt?: Date;

    @Prop({ type: String, default: null })
    cancelReason?: string;

    @Prop({ type: String, default: null, index: true })
    calendlyEventUri?: string;

    @Prop({ type: String, default: null })
    calendlyInviteeUri?: string;

    @Prop({ type: String, enum: ['manual', 'calendly', 'zoom'], default: 'manual', index: true })
    source: string;

    @Prop({ type: Object, default: null })
    calendlyMetadata?: {
        eventTypeUri?: string;
        eventTypeName?: string;
        inviteeName?: string;
        inviteeEmail?: string;
        location?: {
            type?: string;
            location?: string;
            join_url?: string;
        };
        questionsAndAnswers?: Array<{
            question: string;
            answer: string;
            position?: number;
        }>;
        tracking?: {
            utm_source?: string;
            utm_campaign?: string;
            utm_medium?: string;
            utm_content?: string;
            utm_term?: string;
        };
        canceledBy?: string;
        cancelerType?: string;
    };

    @Prop({ type: String, default: null })
    zoomMeetingId?: string;

    @Prop({ type: Object, default: null })
    zoomMetadata?: {
        meetingId: string;
        meetingPassword?: string;
        joinUrl: string;
        startUrl?: string;
        hostEmail: string;
        hostId?: string;
        createdAt?: Date;
        createdBy?: 'calendly' | 'custom_api'; // Track Zoom meeting source
    };
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

AppointmentSchema.pre('save', function (next) {
    if (this.isModified('meetingDate') && this.meetingDate) {
        const endTime = new Date(this.meetingDate.getTime() + 60 * 60 * 1000);
        (this as any).endTime = endTime;
    }
    next();
});

AppointmentSchema.index({ meetingDate: 1, endTime: 1 });
AppointmentSchema.index({ userId: 1, meetingDate: 1 });
AppointmentSchema.index({ mentorId: 1, meetingDate: 1 });
AppointmentSchema.index({ status: 1, mentorId: 1 });
AppointmentSchema.index({ status: 1, userId: 1 });
AppointmentSchema.index({ status: 1, meetingDate: -1 });
AppointmentSchema.index({ platform: 'text', status: 'text', notes: 'text' });
AppointmentSchema.index({ calendlyEventUri: 1 });
AppointmentSchema.index({ calendlyInviteeUri: 1 });
AppointmentSchema.index({ zoomMeetingId: 1 });
AppointmentSchema.index({ source: 1 });