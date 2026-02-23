import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { Appointment, AppointmentSchema } from './schemas/appointment.schema';
import { Availability, AvailabilitySchema } from './schemas/availability.schema';
import { HomeModule } from '../home/home.module';
import { ZoomModule } from '../zoom/zoom.module';
import { MailerService } from '../../common/utils/mail.util';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Appointment.name, schema: AppointmentSchema },
            { name: Availability.name, schema: AvailabilitySchema }
        ]),
        HomeModule,
        ZoomModule,
        ConfigModule,
    ],
    controllers: [AppointmentsController],
    providers: [AppointmentsService, MailerService],
    exports: [AppointmentsService],
})
export class AppointmentsModule { }