import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsEnum, IsMongoId, IsBoolean } from 'class-validator';
import { Types } from 'mongoose';

export class CreateUserDto {
    @IsNotEmpty()
    firstName: string;

    @IsNotEmpty()
    lastName: string;

    @IsEmail()
    email: string;

    @IsOptional()
    username?: string;

    @IsOptional()
    @MinLength(6)
    password?: string;

    @IsOptional()
    @IsEnum(['director', 'mentor', 'field mentor', 'pastor', 'pending'])
    role?: string;

    @IsOptional()
    @IsEnum(['new', 'pending', 'accepted'])
    status?: string;

    @IsOptional()
    @IsMongoId()
    interestId?: Types.ObjectId;

    @IsOptional()
    profilePicture?: string;

    @IsOptional()
    @IsBoolean()
    isEmailVerified?: boolean;
}