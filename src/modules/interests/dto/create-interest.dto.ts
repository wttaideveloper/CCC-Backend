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

    @IsString()
    @IsOptional()
    interests?: string[];

    @IsString()
    @IsOptional()
    comments?: string;
}
