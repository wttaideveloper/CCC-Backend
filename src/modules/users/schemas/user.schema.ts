import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { nanoid } from 'nanoid';

export type UserDocument = Document<unknown, {}, User> & User & {
    _id: Types.ObjectId;
};

@Schema({ timestamps: true })
export class User {
    readonly _id?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Interest' })
    interestId?: Types.ObjectId;

    @Prop({ required: true })
    firstName: string;

    @Prop({ required: true })
    lastName: string;

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ unique: true, sparse: true })
    username?: string;

    @Prop()
    password?: string;

    @Prop({ enum: ['director', 'mentor', 'field mentor', 'pastor', 'pending'], default: 'pending' })
    role: string;

    @Prop({
        required: true,
        unique: true,
        default: () => nanoid(),
        index: true
    })
    roleId: string;

    @Prop()
    profilePicture?: string;

    @Prop({
        enum: ['new', 'pending', 'accepted'],
        default: 'new',
    })
    status: string;

    @Prop({ default: false })
    isEmailVerified: boolean;

    @Prop()
    refreshToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);