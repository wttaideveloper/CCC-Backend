import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MentorMenteeDetailsDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @IsNotEmpty()
  roleId: string;

  @IsString()
  @IsOptional()
  profileInfo?: string;

  @IsOptional()
  churchDetails?: any[];

  @IsString()
  @IsOptional()
  conference?: string;
}
