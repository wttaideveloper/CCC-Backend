import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Progress, ProgressSchema } from './schemas/progress.schema';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { RoadMap, RoadMapSchema } from '../roadmaps/schemas/roadmap.schema';
import { Assessment, AssessmentSchema } from '../assessment/schemas/assessment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Progress.name, schema: ProgressSchema },
            { name: RoadMap.name, schema: RoadMapSchema },
            { name: Assessment.name, schema: AssessmentSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [ProgressController],
    providers: [ProgressService],
    exports: [ProgressService],
})
export class ProgressModule { }