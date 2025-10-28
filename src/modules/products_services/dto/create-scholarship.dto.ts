import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { VALID_SCHOLARSHIP_TYPES, VALID_SCHOLARSHIP_STATUSES } from '../../../common/constants/status.constants';

export class CreateScholarshipDto {
  @IsEnum(VALID_SCHOLARSHIP_TYPES)
  @IsNotEmpty()
  type: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(VALID_SCHOLARSHIP_STATUSES)
  @IsOptional()
  status?: string;
}
