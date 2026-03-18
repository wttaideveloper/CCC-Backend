import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
} from 'class-validator';

export class AwardedUserDto {
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  user?: any;

  @IsDateString()
  @IsNotEmpty()
  awardedDate: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  academicYear?: string;

  @IsEnum(['active', 'completed', 'revoked'])
  @IsOptional()
  awardStatus?: string;
}
