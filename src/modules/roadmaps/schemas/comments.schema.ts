import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type CommentItemDocument = Document<unknown, {}, CommentItem> & CommentItem & {
    _id: Types.ObjectId;
};

@Schema()
export class CommentItem {

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    mentorId: Types.ObjectId;

    @Prop({ required: true })
    text: string;

    @Prop({ type: Date, default: Date.now })
    addedDate: Date;
}

export const CommentItemSchema = SchemaFactory.createForClass(CommentItem);

export type CommentsDocument = Document<unknown, {}, Comments> & Comments & {
    _id: Types.ObjectId;
};

@Schema({ timestamps: true })
export class Comments {

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'RoadMap', required: true })
    roadMapId: Types.ObjectId;

    @Prop({ type: [CommentItemSchema], default: [] })
    comments: Types.Array<CommentItem>;
}

export const CommentsSchema = SchemaFactory.createForClass(Comments);
