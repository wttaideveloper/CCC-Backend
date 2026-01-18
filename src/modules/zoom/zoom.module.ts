import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ZoomController } from './zoom.controller';
import { ZoomService } from './zoom.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { EncryptionService } from '../../common/utils/encryption.util';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Appointment.name, schema: AppointmentSchema },
        ]),
    ],
    controllers: [ZoomController],
    providers: [ZoomService, EncryptionService],
    exports: [ZoomService],
})
export class ZoomModule {}
