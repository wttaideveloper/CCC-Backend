import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Encryption utility for securely storing sensitive data like OAuth tokens
 * Uses AES-256-GCM for authenticated encryption
 */
@Injectable()
export class EncryptionService {
    private readonly logger = new Logger(EncryptionService.name);
    private readonly algorithm = 'aes-256-gcm';
    private readonly ivLength = 16;
    private readonly saltLength = 64;
    private readonly tagLength = 16;
    private readonly encryptionKey: Buffer;

    constructor(private readonly configService: ConfigService) {
        const key = this.configService.get<string>('ENCRYPTION_KEY');
        if (!key) {
            this.logger.warn('ENCRYPTION_KEY not set. Using default key (NOT SECURE FOR PRODUCTION)');
            // Generate a consistent but insecure key for development
            this.encryptionKey = crypto.scryptSync('default-dev-key', 'salt', 32);
        } else {
            // Derive key from base64 encoded string
            const keyBuffer = Buffer.from(key, 'base64');
            this.encryptionKey = crypto.scryptSync(keyBuffer, 'salt', 32);
        }
    }

    /**
     * Encrypt sensitive data
     * @param text - Plain text to encrypt
     * @returns Encrypted string in format: salt:iv:encrypted:authTag (all base64)
     */
    encrypt(text: string): string {
        try {
            if (!text) return text;

            // Generate random IV for each encryption
            const iv = crypto.randomBytes(this.ivLength);

            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

            // Encrypt
            let encrypted = cipher.update(text, 'utf8', 'base64');
            encrypted += cipher.final('base64');

            // Get auth tag
            const authTag = cipher.getAuthTag();

            // Return format: iv:encrypted:authTag
            return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
        } catch (error) {
            this.logger.error('Encryption failed:', error);
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypt encrypted data
     * @param encryptedData - Encrypted string in format: iv:encrypted:authTag
     * @returns Decrypted plain text
     */
    decrypt(encryptedData: string): string {
        try {
            if (!encryptedData) return encryptedData;

            // Parse encrypted data
            const parts = encryptedData.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }

            const [ivBase64, encrypted, authTagBase64] = parts;
            const iv = Buffer.from(ivBase64, 'base64');
            const authTag = Buffer.from(authTagBase64, 'base64');

            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
            decipher.setAuthTag(authTag);

            // Decrypt
            let decrypted = decipher.update(encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            this.logger.error('Decryption failed:', error);
            throw new Error('Decryption failed');
        }
    }

    /**
     * Encrypt object fields
     * @param obj - Object with fields to encrypt
     * @param fields - Array of field names to encrypt
     * @returns Object with encrypted fields
     */
    encryptFields<T extends Record<string, any>>(obj: T, fields: (keyof T)[]): T {
        const result = { ...obj };
        for (const field of fields) {
            if (result[field] && typeof result[field] === 'string') {
                result[field] = this.encrypt(result[field] as string) as any;
            }
        }
        return result;
    }

    /**
     * Decrypt object fields
     * @param obj - Object with encrypted fields
     * @param fields - Array of field names to decrypt
     * @returns Object with decrypted fields
     */
    decryptFields<T extends Record<string, any>>(obj: T, fields: (keyof T)[]): T {
        const result = { ...obj };
        for (const field of fields) {
            if (result[field] && typeof result[field] === 'string') {
                try {
                    result[field] = this.decrypt(result[field] as string) as any;
                } catch (error) {
                    this.logger.warn(`Failed to decrypt field ${String(field)}`);
                }
            }
        }
        return result;
    }

    /**
     * Generate a secure random token
     * @param length - Length in bytes (default: 32)
     * @returns Random token as hex string
     */
    generateToken(length: number = 32): string {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Hash a value using SHA-256
     * @param value - Value to hash
     * @returns Hashed value as hex string
     */
    hash(value: string): string {
        return crypto.createHash('sha256').update(value).digest('hex');
    }
}
