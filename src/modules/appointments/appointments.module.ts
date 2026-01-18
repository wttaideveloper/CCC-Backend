import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { Appointment, AppointmentSchema } from './schemas/appointment.schema';
import { Availability, AvailabilitySchema } from './schemas/availability.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { HomeModule } from '../home/home.module';
import { ZoomModule } from '../zoom/zoom.module';
import { CalendlyModule } from '../calendly/calendly.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Appointment.name, schema: AppointmentSchema },
            { name: Availability.name, schema: AvailabilitySchema },
            { name: User.name, schema: UserSchema }
        ]),
        HomeModule,
        forwardRef(() => ZoomModule),
        forwardRef(() => CalendlyModule),
    ],
    controllers: [AppointmentsController],
    providers: [AppointmentsService],
    exports: [AppointmentsService],
})
export class AppointmentsModule { }