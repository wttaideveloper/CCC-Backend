import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { ExpoNotificationService } from './expo.service';

@Global()
@Module({
    providers: [FirebaseService, ExpoNotificationService],
    exports: [FirebaseService, ExpoNotificationService],
})
export class FirebaseModule { }