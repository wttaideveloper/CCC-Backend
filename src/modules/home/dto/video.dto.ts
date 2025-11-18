import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateVideoDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    heading: string;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    subheading?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;
}

export class UpdateVideoDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    heading?: string;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    subheading?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @IsOptional()
    @IsString()
    video?: string;

    @IsOptional()
    isActive?: boolean;
}