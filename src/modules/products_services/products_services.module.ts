import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsServicesController } from './products_services.controller';
import { ProductsServicesService } from './products_services.service';
import {
  Scholarship,
  ScholarshipSchema,
} from './schemas/scholarship.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Scholarship.name, schema: ScholarshipSchema },
    ]),
  ],
  controllers: [ProductsServicesController],
  providers: [ProductsServicesService],
  exports: [ProductsServicesService],
})
export class ProductsServicesModule { }