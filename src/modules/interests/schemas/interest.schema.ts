import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InterestDocument = Document<unknown, {}, Interest> &
  Interest & {
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

  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  profilePicture?: string;

  @Prop({ type: [ChurchDetails], default: [] })
  churchDetails: ChurchDetails[];

  @Prop()
  title?: string;

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
}

export const InterestSchema = SchemaFactory.createForClass(Interest);
