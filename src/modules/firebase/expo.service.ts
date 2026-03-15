import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ExpoNotificationService {
    private readonly logger = new Logger(ExpoNotificationService.name);

    async sendPushNotification(
        tokens: string[],
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<{ invalidTokens: string[] }> {

        if (!tokens?.length) {
            return { invalidTokens: [] };
        }

        const messages = tokens.map(token => ({
            to: token,
            sound: 'default',
            title,
            body,
            data,
        }));

        try {
            const response = await axios.post(
                'https://exp.host/--/api/v2/push/send',
                messages,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );

            const invalidTokens: string[] = [];

            const results = response.data?.data || [];

            results.forEach((result: any, index: number) => {
                if (result.status === 'error') {
                    if (
                        result.details?.error === 'DeviceNotRegistered' ||
                        result.details?.error === 'InvalidCredentials'
                    ) {
                        invalidTokens.push(tokens[index]);
                    }
                }
            });

            return { invalidTokens };

        } catch (error) {
            this.logger.error('Expo push notification failed', error);
            return { invalidTokens: [] };
        }
    }
}