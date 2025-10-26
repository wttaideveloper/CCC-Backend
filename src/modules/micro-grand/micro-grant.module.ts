import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MicroGrantController } from './micro-grant.controller';
import { MicroGrantService } from './micro-grant.service';
import { MicroGrantForm, MicroGrantFormSchema } from './schemas/micro-grant-form.schema';
import { MicroGrantApplication, MicroGrantApplicationSchema } from './schemas/micro-grant-application.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MicroGrantForm.name, schema: MicroGrantFormSchema },
      { name: MicroGrantApplication.name, schema: MicroGrantApplicationSchema },
    ]),
  ],
  controllers: [MicroGrantController],
  providers: [MicroGrantService],
})
export class MicroGrantModule {}
