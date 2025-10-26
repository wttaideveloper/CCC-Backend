import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import configuration from './config/configuration';
import { InterestModule } from './modules/interests/interests.module';
import { AuthModule } from './modules/auth/auth.module';
import { HomeModule } from './modules/home/home.module';
import { RoadMapsModule } from './modules/roadmaps/roadmaps.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { MicroGrantModule } from './modules/micro-grand/micro-grant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),

    DatabaseModule,
    AuthModule,
    UsersModule,
    InterestModule,
    HomeModule,
    RoadMapsModule,
    AppointmentsModule,
    AssessmentModule,
    MicroGrantModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
