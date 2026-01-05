import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { RoadMap, RoadMapSchema } from '../roadmaps/schemas/roadmap.schema';
import {
  Appointment,
  AppointmentSchema,
} from '../appointments/schemas/appointment.schema';
import {
  Assessment,
  AssessmentSchema,
} from '../assessment/schemas/assessment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Interest, InterestSchema } from '../interests/schemas/interest.schema';
import {
  Scholarship,
  ScholarshipSchema,
} from '../products_services/schemas/scholarship.schema';
import {
  MicroGrantApplication,
  MicroGrantApplicationSchema,
} from '../micro-grand/schemas/micro-grant-application.schema';
import { Progress, ProgressSchema } from '../progress/schemas/progress.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoadMap.name, schema: RoadMapSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Assessment.name, schema: AssessmentSchema },
      { name: User.name, schema: UserSchema },
      { name: Interest.name, schema: InterestSchema },
      { name: Scholarship.name, schema: ScholarshipSchema },
      { name: MicroGrantApplication.name, schema: MicroGrantApplicationSchema },
      { name: Progress.name, schema: ProgressSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
