import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import configuration from './config/configuration';
import { InterestModule } from './modules/interests/interests.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),

    DatabaseModule,
    AuthModule,
    UsersModule,
    InterestModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
