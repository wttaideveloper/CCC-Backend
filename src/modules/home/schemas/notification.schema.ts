import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class NotificationItem {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  details: string;

  @Prop()
  module?: string;

  @Prop({ default: false })
  read: boolean;
}
export const NotificationItemSchema =
  SchemaFactory.createForClass(NotificationItem);

export type NotificationDocument = Document<unknown, {}, Notification> &
  Notification & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true })
export class Notification {
  readonly _id?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  roleId?: string;

  @Prop({
    type: [NotificationItemSchema],
    default: [],
  })
  notifications: NotificationItem[];
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
