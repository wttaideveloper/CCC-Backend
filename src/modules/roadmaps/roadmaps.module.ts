import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoadMapsService } from './roadmaps.service';
import { RoadMapsController } from './roadmaps.controller';
import { RoadMap, RoadMapSchema } from './schemas/roadmap.schema';
import { Comments, CommentsSchema } from './schemas/comments.schema';
import { Queries, QueriesSchema } from './schemas/queries.schema';
import { Extras, ExtrasSchema } from './schemas/extras.schema';
import { Progress, ProgressSchema } from '../progress/schemas/progress.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: RoadMap.name, schema: RoadMapSchema },
            { name: Comments.name, schema: CommentsSchema },
            { name: Queries.name, schema: QueriesSchema },
            { name: Extras.name, schema: ExtrasSchema },
            { name: Progress.name, schema: ProgressSchema },
        ]),
    ],
    controllers: [RoadMapsController],
    providers: [RoadMapsService],
    exports: [RoadMapsService],
})
export class RoadMapsModule { }