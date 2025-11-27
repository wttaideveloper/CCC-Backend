import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AwardedUserResponseDto {
  @IsString()
  userId: string;

  awardedDate: Date;

  @IsOptional()
  notes?: string;

  @IsOptional()
  academicYear?: string;

  @IsString()
  awardStatus: string;
}

export class ScholarshipResponseDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['active', 'inactive'])
  status: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AwardedUserResponseDto)
  awardedList: AwardedUserResponseDto[];

  @IsNumber()
  numberOfAwards: number;

  @IsNumber()
  totalAmount: number;

  createdAt: Date;
  updatedAt: Date;
}
