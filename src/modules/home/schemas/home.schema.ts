import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HomeDocument = Document<unknown, {}, Home> & Home & {
    _id: Types.ObjectId;
};

@Schema({ timestamps: true })
export class Home {
    readonly _id?: Types.ObjectId;

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true })
    username: string;

    @Prop()
    appointments: string[];

    @Prop()
    roadmaps: string[];

    @Prop()
    mentors: string[]

    // @Prop({ type: [AppointmentSchema], default: [] })
    // appointments: Appointment[];

}

export const HomeSchema = SchemaFactory.createForClass(Home);