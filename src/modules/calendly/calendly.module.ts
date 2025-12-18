import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CalendlyController } from './calendly.controller';
import { CalendlyService } from './calendly.service';
import { CalendlyEventLog, CalendlyEventSchema } from './schemas/calendly-event.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { HomeModule } from '../home/home.module';
import { MailerService } from '../../common/utils/mail.util';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: CalendlyEventLog.name, schema: CalendlyEventSchema },
            { name: Appointment.name, schema: AppointmentSchema },
            { name: User.name, schema: UserSchema },
        ]),
        forwardRef(() => HomeModule),
    ],
    controllers: [CalendlyController],
    providers: [CalendlyService, MailerService],
    exports: [CalendlyService],
})
export class CalendlyModule {}
