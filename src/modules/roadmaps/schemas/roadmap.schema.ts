import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { VALID_ROADMAP_STATUSES, ROADMAP_STATUSES } from '../../../common/constants/status.constants';

@Schema()
export class NestedRoadMapItem {
    readonly _id?: Types.ObjectId;

    @Prop({ required: true })
    name: string;

    @Prop()
    roadMapDetails: string;

    @Prop()
    description: string;

    @Prop({ enum: VALID_ROADMAP_STATUSES, default: ROADMAP_STATUSES.NOT_STARTED })
    status: string;

    @Prop({ required: true })
    duration: string;

    @Prop({ type: Date })
    startDate: Date;

    @Prop({ type: Date })
    endDate: Date;

    @Prop({ type: Date })
    completedOn: Date;

    @Prop()
    imageUrl: string;

    @Prop({ type: [Date], default: [] })
    meetings: Date[];

    @Prop({ default: "" })
    phase: string;

    @Prop({ default: 0, type: Number })
    totalSteps: number;

    @Prop({ type: Object })
    extras: Object;
}

export const NestedRoadMapItemSchema = SchemaFactory.createForClass(NestedRoadMapItem);

export type RoadMapDocument = Document<unknown, {}, RoadMap> & RoadMap & {
    _id: Types.ObjectId;
};

@Schema({ timestamps: true })
export class RoadMap {

    @Prop({ required: true })
    type: string;

    @Prop({ required: true })
    name: string;

    @Prop()
    roadMapDetails: string;

    @Prop()
    description: string;

    @Prop({ enum: VALID_ROADMAP_STATUSES, default: ROADMAP_STATUSES.NOT_STARTED })
    status: string;

    @Prop({ required: true })
    duration: string;

    @Prop({ type: Date })
    startDate?: Date;

    @Prop({ type: Date })
    endDate?: Date;

    @Prop({ type: Date })
    completedOn?: Date;

    @Prop()
    imageUrl?: string;

    @Prop({ type: [Date], default: [] })
    meetings: Date[];

    @Prop({ enum: ['church', 'pastor'], default: 'pastor' })
    division: string;

    @Prop({ default: false })
    haveNextedRoadMaps: boolean;

    @Prop({ default: "" })
    phase: string;

    @Prop({ type: Types.ObjectId, ref: 'Assessment', required: false })
    assesmentId?: Types.ObjectId;

    @Prop({ default: 0, type: Number })
    totalSteps: number;

    @Prop({ type: Object })
    extras?: Object;

    @Prop({ type: [NestedRoadMapItemSchema], default: [] })
    roadmaps: Types.Array<NestedRoadMapItem>;
}

export const RoadMapSchema = SchemaFactory.createForClass(RoadMap);

RoadMapSchema.index({ name: 1 });
RoadMapSchema.index({ status: 1 });
RoadMapSchema.index({ name: 1, status: 1 });
RoadMapSchema.index({ name: 'text', description: 'text' });
RoadMapSchema.index({ status: 1, createdAt: -1 });
RoadMapSchema.index({ type: 1, status: 1 });

RoadMapSchema.pre('save', function (next) {
    const doc = this as RoadMapDocument;
    doc.haveNextedRoadMaps = doc.roadmaps && doc.roadmaps.length > 0;
    next();
});