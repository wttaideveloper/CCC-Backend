import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { S3Module } from '../s3/s3.module';
import { MulterModule } from '@nestjs/platform-express';
import { Interest, InterestSchema } from '../interests/schemas/interest.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema },
        { name: Interest.name, schema: InterestSchema }
        ]),
        S3Module,
        MulterModule.register({
            storage: require('multer').memoryStorage(),
        }),
    ],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
