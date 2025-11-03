import { IsString, IsEmail, IsBoolean } from 'class-validator';

export class UserResponseDto {
    @IsString()
    id: string;

    @IsEmail()
    email: string;

    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @IsString()
    username?: string;

    @IsString()
    role: string;

    @IsString()
    status: string;

    @IsBoolean()
    isEmailVerified: boolean;

}