import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsEnum } from 'class-validator';

export class CreateUserDto {
    @IsNotEmpty()
    firstName: string;

    @IsNotEmpty()
    lastName: string;

    @IsEmail()
    email: string;

    @IsOptional()
    username?: string;

    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @IsOptional()
    @IsEnum(['director', 'mentor', 'pastor', 'pending'])
    role?: string;
}