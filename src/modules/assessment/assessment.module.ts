import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Assessment, AssessmentSchema } from './schemas/assessment.schema';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service.spec';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Assessment.name, schema: AssessmentSchema },
    ]),
  ],
  controllers: [AssessmentController],
  providers: [AssessmentService],
})
export class AssessmentModule {}
