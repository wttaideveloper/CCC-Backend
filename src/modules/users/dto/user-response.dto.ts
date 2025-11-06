import { IsString, IsEmail, IsBoolean, IsOptional, IsDate } from 'class-validator';

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
    @IsOptional()
    username?: string;

    @IsString()
    role: string;

    @IsString()
    roleId: string;

    @IsString()
    @IsOptional()
    profilePicture?: string;

    @IsString()
    @IsOptional()
    interestId?: string;

    @IsString()
    status: string;

    @IsBoolean()
    isEmailVerified: boolean;

    @IsDate()
    createdAt: Date;

    @IsDate()
    updatedAt: Date;
}