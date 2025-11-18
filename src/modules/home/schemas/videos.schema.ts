import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VideoDocument = Video & Document;

@Schema({ timestamps: true, collection: 'videos' })
export class Video {

    @Prop({ type: String, required: true })
    heading: string;

    @Prop({ type: String, required: true })
    subheading: string;

    @Prop({ type: String, required: true })
    description: string;

    @Prop({ type: String, required: true })
    video: string;
}

export const VideoSchema = SchemaFactory.createForClass(Video);
