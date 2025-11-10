import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Extras {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'RoadMap', required: true, index: true })
    roadMapId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'NestedRoadMapItem', required: false })
    nestedRoadMapItemId?: Types.ObjectId;

    @Prop({ type: [Types.Map], default: [] })
    extras: Types.Array<any>;

    createdAt?: Date;
    updatedAt?: Date;
}

export type ExtrasDocument = Document<unknown, {}, Extras> & Extras & {
    _id: Types.ObjectId;
};

export const ExtrasSchema = SchemaFactory.createForClass(Extras);

ExtrasSchema.index({ userId: 1, roadMapId: 1 });
ExtrasSchema.index({ userId: 1, roadMapId: 1, nestedRoadMapItemId: 1 }, { unique: true });