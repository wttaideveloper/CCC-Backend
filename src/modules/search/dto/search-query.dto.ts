import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SearchModule {
  ROADMAPS = 'roadmaps',
  APPOINTMENTS = 'appointments',
  ASSESSMENTS = 'assessments',
  USERS = 'users',
  INTERESTS = 'interests',
  SCHOLARSHIPS = 'scholarships',
  MICRO_GRANTS = 'micro-grants',
  ALL = 'all',
}

export class SearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Search query must be at least 2 characters long' })
  query: string;

  @IsOptional()
  @IsArray()
  @IsEnum(SearchModule, { each: true })
  modules?: SearchModule[] = [SearchModule.ALL];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['relevance', 'date', 'name'])
  sortBy?: string = 'relevance';
}
