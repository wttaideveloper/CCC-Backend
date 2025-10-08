import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CountryStateDto {
    @IsString()
    country: string;

    @IsArray()
    @IsString({ each: true })
    states: string[];
}

export class InterestMetadataDto {
    @IsArray()
    @IsString({ each: true })
    titles: string[];

    @IsArray()
    @IsString({ each: true })
    countries: string[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CountryStateDto)
    countryStates: CountryStateDto[];

    @IsArray()
    @IsString({ each: true })
    interests: string[];
}