import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddNotificationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  details: string;

  @IsString()
  @IsOptional()
  module?: string;

  @IsString()
  @IsOptional()
  roleId?: string;
}

export class GetNotificationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ClearNotificationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class NotificationItemResponseDto {
  name: string;
  details: string;
  module?: string;
}

export class NotificationResponseDto {
  _id: string;
  email: string;
  roleId?: string;
  notifications: NotificationItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}
