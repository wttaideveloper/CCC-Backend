import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateScholarshipDto {
  @IsEnum([
    'Full Scholarship',
    'Partial Scholarship',
    'Full Cost',
    'Half Scholarship',
    'ADRA Discount',
  ])
  @IsNotEmpty()
  type: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive'])
  @IsOptional()
  status?: string;
}
