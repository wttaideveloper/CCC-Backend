import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class NestedRoadMapItem {
  readonly _id?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  roadMapDetails: string;

  @Prop()
  description: string;

  @Prop({ enum: ['due', 'not started', 'completed'], default: 'not started' })
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

  @Prop({ type: Object })
  extras: Object;
}

export const NestedRoadMapItemSchema =
  SchemaFactory.createForClass(NestedRoadMapItem);

export type RoadMapDocument = Document<unknown, {}, RoadMap> &
  RoadMap & {
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

  @Prop({ enum: ['due', 'not started', 'completed'], default: 'not started' })
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

  @Prop({ default: '' })
  phase: string;

  @Prop({ type: Object })
  extras?: Object;

  @Prop({ type: [NestedRoadMapItemSchema], default: [] })
  roadmaps: Types.Array<NestedRoadMapItem>;
}

export const RoadMapSchema = SchemaFactory.createForClass(RoadMap);

RoadMapSchema.pre('save', function (next) {
  const doc = this as RoadMapDocument;
  doc.haveNextedRoadMaps = doc.roadmaps && doc.roadmaps.length > 0;
  next();
});
