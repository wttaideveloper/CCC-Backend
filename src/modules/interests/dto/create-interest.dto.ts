import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

class ChurchDetailsDto {
    @IsString()
    @IsOptional()
    churchName?: string;

    @IsString()
    @IsOptional()
    churchPhone?: string;

    @IsString()
    @IsOptional()
    churchWebsite?: string;

    @IsString()
    @IsOptional()
    churchAddress?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    state?: string;

    @IsString()
    @IsOptional()
    zipCode?: string;

    @IsString()
    @IsOptional()
    country?: string;
}

export class CreateInterestDto {
    @IsString()
    @IsOptional()
    profileInfo?: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsString()
    @IsNotEmpty()
    phoneNumber: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsOptional()
    profilePicture?: string;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => ChurchDetailsDto)
    churchDetails?: ChurchDetailsDto[];

    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    conference?: string;

    @IsString()
    @IsOptional()
    yearsInMinistry?: string;

    @IsString()
    @IsOptional()
    currentCommunityProjects?: string;

    @IsString({ each: true })
    @IsOptional()
    @IsArray()
    interests?: string[];

    @IsString()
    @IsOptional()
    comments?: string;
}

export class UpdateInterestDto extends PartialType(CreateInterestDto) {}