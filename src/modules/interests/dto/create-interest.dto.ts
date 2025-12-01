import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsEnum, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { VALID_USER_APPLICATION_STATUSES } from '../../../common/constants/status.constants';
import { TITLES_LIST } from '../../../shared/constants/metadata.constants';

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
    @IsIn(TITLES_LIST, { message: 'Title must be one of the following: ' + TITLES_LIST.join(', ') })
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

    @IsEnum(VALID_USER_APPLICATION_STATUSES)
    @IsOptional()
    status?: string;

    @IsOptional()
    @IsObject()
    dynamicFieldValues?: Record<string, string | string[] | boolean | number>;
}

export class UpdateInterestDto extends PartialType(CreateInterestDto) {}
