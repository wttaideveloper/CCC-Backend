import { IsString, IsEmail, IsOptional, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class ChurchDetailsResponseDto {
    @IsOptional()
    @IsString()
    churchName?: string;

    @IsOptional()
    @IsString()
    churchPhone?: string;

    @IsOptional()
    @IsString()
    churchWebsite?: string;

    @IsOptional()
    @IsString()
    churchAddress?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    state?: string;

    @IsOptional()
    @IsString()
    zipCode?: string;

    @IsOptional()
    @IsString()
    country?: string;
}

export class InterestResponseDto {
    @IsString()
    @IsNotEmpty()
    id: string;

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
    @Type(() => ChurchDetailsResponseDto)
    churchDetails?: ChurchDetailsResponseDto[];

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    conference?: string;

    @IsOptional()
    @IsString()
    yearsInMinistry?: string;

    @IsOptional()
    @IsString()
    currentCommunityProjects?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    interests?: string[];

    @IsOptional()
    @IsString()
    comments?: string;

}