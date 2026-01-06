import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Assessment, AssessmentSchema } from './schemas/assessment.schema';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UserAnswer, UserAnswerSchema } from './schemas/answer.schema';
import { Progress, ProgressSchema } from '../progress/schemas/progress.schema';
import { S3Module } from '../s3/s3.module';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Assessment.name, schema: AssessmentSchema },
      { name: User.name, schema: UserSchema },
      { name: UserAnswer.name, schema: UserAnswerSchema },
      { name: Progress.name, schema: ProgressSchema },
    ]),
    S3Module,
    MulterModule.register({
      storage: require('multer').memoryStorage(),
    }),
  ],
  controllers: [AssessmentController],
  providers: [AssessmentService],
})
export class AssessmentModule { }
