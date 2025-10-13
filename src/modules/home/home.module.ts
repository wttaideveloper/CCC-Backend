import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
// import { Notification, NotificationSchema } from './schemas/notification.schema';
import { Home, HomeSchema } from './schemas/home.schema';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [MongooseModule.forFeature([{ name: Home.name, schema: HomeSchema }]), UsersModule],
    controllers: [HomeController],
    providers: [HomeService],
    exports: [HomeService],
})
export class HomeModule { }