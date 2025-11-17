import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Extras {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'RoadMap', required: true, index: true })
    roadMapId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'NestedRoadMapItem', required: false })
    nestedRoadMapItemId?: Types.ObjectId;

    @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
    extras: any[];

    @Prop({
        type: [{
            fileName: { type: String, required: true },
            fileUrl: { type: String, required: true },
            fileType: { type: String, required: true },
            fileSize: { type: Number, required: true },
            uploadedAt: { type: Date, default: Date.now },
        }],
        default: [],
    })
    uploadedDocuments: {
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
        uploadedAt: Date;
    }[];

    createdAt?: Date;
    updatedAt?: Date;
}

export type ExtrasDocument = Document<unknown, {}, Extras> & Extras & {
    _id: Types.ObjectId;
};

export const ExtrasSchema = SchemaFactory.createForClass(Extras);

ExtrasSchema.index({ userId: 1, roadMapId: 1 });
ExtrasSchema.index({ userId: 1, roadMapId: 1, nestedRoadMapItemId: 1 }, { unique: true });