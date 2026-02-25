import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeFirebase } from './firebase.config';

@Injectable()
export class FirebaseService {
    private readonly logger = new Logger(FirebaseService.name);

    constructor(private readonly configService: ConfigService) {
        initializeFirebase(this.configService);
    }

    async sendPushNotification(
        tokens: string[],
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<{ invalidTokens: string[] }> {
        if (!tokens?.length) {
            return { invalidTokens: [] }; 
        }

        try {
            const admin = await import('firebase-admin');

            const response = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: { title, body },
                data,
            });

            const invalidTokens: string[] = [];

            response.responses.forEach((res, index) => {
                if (!res.success) {
                    const errorCode = res.error?.code;

                    if (
                        errorCode === 'messaging/registration-token-not-registered' ||
                        errorCode === 'messaging/invalid-registration-token'
                    ) {
                        invalidTokens.push(tokens[index]);
                    }
                }
            });
            return { invalidTokens };
        } catch (error) {
            this.logger.error('FCM send failed', error);
            return { invalidTokens: [] };
        }
    }
}