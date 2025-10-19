import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Interest, InterestSchema } from './schemas/interest.schema';
import { InterestController } from './interests.controller';
import { InterestService } from './interests.service';
import { MailerService } from 'src/common/utils/mail.util';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Interest.name, schema: InterestSchema },
    ]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [InterestController],
  providers: [InterestService, MailerService],
  exports: [InterestService],
})
export class InterestModule {}
