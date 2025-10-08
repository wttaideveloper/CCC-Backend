import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { UserResponseDto } from 'src/modules/users/dto/user-response.dto';

export class LoginDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    password: string;
}

export class LoginResponseDto {
    @IsNotEmpty()
    accessToken: string;

    @IsNotEmpty()
    refreshToken: string;

    @IsOptional()
    user?: UserResponseDto
}