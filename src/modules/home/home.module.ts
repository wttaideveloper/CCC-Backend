import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { Home, HomeSchema } from './schemas/home.schema';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Video, VideoSchema } from './schemas/videos.schema';
import { S3Module } from '../s3/s3.module';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Home.name, schema: HomeSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Video.name, schema: VideoSchema }
    ]),
    UsersModule,
    S3Module,
    MulterModule.register({
      storage: require('multer').memoryStorage(),
    }),
  ],

  controllers: [HomeController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule { }
