import { IsEmail, IsNotEmpty, IsOptional, isString, IsString } from 'class-validator';

export class MentorResponseDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsOptional()
    username?: string;

    @IsString()
    @IsNotEmpty()
    role: string;

    @IsString()
    @IsNotEmpty()
    roleId: string;

    @IsString()
    @IsOptional()
    profileInfo?: string;

    @IsString()
    @IsOptional()
    phoneNumber?: string;
}
