import { IsNotEmpty, IsOptional, IsString, IsMongoId } from 'class-validator';

export class AddNotificationDto {
  @IsMongoId()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  details: string;

  @IsString()
  @IsOptional()
  module?: string;
}

export class GetNotificationDto {
  @IsMongoId()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  role?: string;
}

export class ClearNotificationDto {
  @IsMongoId()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  role?: string;
}

export class NotificationItemResponseDto {
  name: string;
  details: string;
  module?: string;
}

export class NotificationResponseDto {
  _id: string;

  userId?: string;
  role?: string;

  notifications: NotificationItemResponseDto[];

  createdAt: Date;
  updatedAt: Date;
}
