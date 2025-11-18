import { IsString, IsEmail, IsBoolean, IsOptional, IsDate, IsMongoId, IsArray, ArrayMinSize } from 'class-validator';

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

    @IsBoolean()
    hasCompleted: boolean;

    @IsBoolean()
    hasIssuedCertificate: boolean;

    @IsDate()
    createdAt: Date;

    @IsDate()
    updatedAt: Date;
}

export class AssignMentorMenteeDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsMongoId({ each: true })
    assignedId: string[];
}

export class RemoveMentorMenteeDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsMongoId({ each: true })
    assignedId: string[];
}