import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class HomeResponseDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    username: string;

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    appointments?: string[];

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    roadmaps?: string[];

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    mentors?: string[];
}