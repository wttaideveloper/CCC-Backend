import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

let firebaseApp: admin.app.App | null = null;

export const initializeFirebase = (
    configService: ConfigService,
): admin.app.App => {
    if (firebaseApp) return firebaseApp;

    const firebaseConfig = configService.get('firebase');

    firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
            projectId: firebaseConfig.projectId,
            clientEmail: firebaseConfig.clientEmail,
            privateKey: firebaseConfig.privateKey,
        }),
    });

    return firebaseApp;
};