import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { USER_APPLICATION_STATUSES, VALID_USER_APPLICATION_STATUSES } from '../../../common/constants/status.constants';
import { TITLES_LIST } from '../../../shared/constants/metadata.constants';

export type InterestDocument = Document<unknown, {}, Interest> & Interest & {
    _id: Types.ObjectId;
};

@Schema()
export class ChurchDetails {
    @Prop({ required: true })
    churchName: string;

    @Prop()
    churchPhone?: string;

    @Prop()
    churchWebsite?: string;

    @Prop()
    churchAddress?: string;

    @Prop()
    city?: string;

    @Prop()
    state?: string;

    @Prop()
    zipCode?: string;

    @Prop()
    country?: string;
}

@Schema({ timestamps: true })
export class Interest {

    @Prop({ type: Types.ObjectId, ref: 'User' })
    userId?: Types.ObjectId;

    @Prop()
    profileInfo?: string;

    @Prop({ required: true })
    firstName: string;

    @Prop({ required: true })
    lastName: string;

    @Prop()
    phoneNumber: string;

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ enum: ['self', 'admin'], default: 'self' })
    createdBy: string;

    @Prop()
    profilePicture?: string;

    @Prop({ type: [ChurchDetails], default: [] })
    churchDetails: ChurchDetails[];

    @Prop({ required: true, enum: TITLES_LIST })
    title: string;

    @Prop()
    conference?: string;

    @Prop()
    yearsInMinistry?: string;

    @Prop()
    currentCommunityProjects?: string;

    @Prop()
    interests?: string[];

    @Prop()
    comments?: string;

    @Prop({ enum: VALID_USER_APPLICATION_STATUSES, default: USER_APPLICATION_STATUSES.NEW })
    status: string;

    @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
    dynamicFieldValues: Record<string, string | string[] | boolean | number>;

}

export const InterestSchema = SchemaFactory.createForClass(Interest);

InterestSchema.index({ 'churchDetails.country': 1 });
InterestSchema.index({ 'churchDetails.conference': 1 });
InterestSchema.index({ userId: 1 });
InterestSchema.index({ status: 1 });
InterestSchema.index({ createdAt: -1 });
InterestSchema.index({ 'churchDetails.country': 1, 'churchDetails.state': 1 });
InterestSchema.index({ email: 1 });
InterestSchema.index({ firstName: 'text', lastName: 'text', email: 'text', title: 'text', conference: 'text' });
