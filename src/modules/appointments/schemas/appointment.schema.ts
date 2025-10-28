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
AppointmentSchema.index({ status: 1 });
AppointmentSchema.index({ status: 1, mentorId: 1 });
AppointmentSchema.index({ status: 1, userId: 1 });
AppointmentSchema.index({ status: 1, meetingDate: -1 });