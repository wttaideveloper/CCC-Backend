import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MediaDocument = Media & Document;

@Schema({ timestamps: true, collection: 'media' })
export class Media {
    @Prop({ type: String, required: true })
    heading: string;

    @Prop({ type: String })
    subheading?: string;

    @Prop({ type: String })
    description?: string;

    @Prop({
        type: [
            {
                url: { type: String, required: true },
                type: { type: String, enum: ['image', 'video'], required: true },
                fileName: { type: String, required: true },
                uploadedAt: { type: Date, default: Date.now },
                size: { type: Number },
            },
        ],
        default: [],
    })
    mediaFiles: {
        url: string;
        type: 'image' | 'video';
        fileName: string;
        uploadedAt?: Date;
        size?: number;
    }[];
}

export const MediaSchema = SchemaFactory.createForClass(Media);
