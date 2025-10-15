import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
// import { Notification, NotificationSchema } from './schemas/notification.schema';
import { Home, HomeSchema } from './schemas/home.schema';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Home.name, schema: HomeSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UsersModule,
  ],

  controllers: [HomeController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule {}