import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly logger = new Logger(S3Service.name);

    constructor(private configService: ConfigService) {
        this.s3Client = new S3Client({});

        const bucket = this.configService.get<string>('aws.s3Bucket');

        if (!bucket) {
            throw new Error('AWS_S3_BUCKET (aws.s3Bucket) is not defined in configuration.');
        }

        this.bucketName = bucket;
    }

    async uploadFile(key: string, body: Buffer, mimeType: string): Promise<string> {
        const params: PutObjectCommandInput = {
            Bucket: this.bucketName,
            Key: key,
            Body: body,
            ContentType: mimeType,
        };

        try {
            const command = new PutObjectCommand(params);
            await this.s3Client.send(command);

            const region = this.configService.get<string>('aws.region');
            // Return public URL (no signing required)
            const fileUrl = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;

            return fileUrl;

        } catch (error) {
            this.logger.error(`S3 Upload failed for key: ${key}`, error.stack);
            throw new Error('S3_UPLOAD_FAILED');
        }
    }

}