import { IsString, IsNotEmpty, IsNumber, IsDate, IsOptional } from 'class-validator';

export class UploadDocumentDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    fileUrl: string;

    @IsString()
    @IsNotEmpty()
    fileType: string;

    @IsNumber()
    fileSize: number;

    @IsDate()
    @IsOptional()
    uploadedAt?: Date;
}

export class UserDocumentResponseDto {
    @IsString()
    fileName: string;

    @IsString()
    fileUrl: string;

    @IsString()
    fileType: string;

    @IsNumber()
    fileSize: number;

    @IsDate()
    uploadedAt: Date;
}
