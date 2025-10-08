import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Interest, InterestSchema } from './schemas/interest.schema';
import { InterestController } from './interests.controller';
import { InterestService } from './interests.service';
import { MailerService } from 'src/common/utils/mail.util';

@Module({
  imports: [MongooseModule.forFeature([{ name: Interest.name, schema: InterestSchema }])],
  controllers: [InterestController],
  providers: [InterestService, MailerService],
  exports: [InterestService],
})
export class InterestModule {}
