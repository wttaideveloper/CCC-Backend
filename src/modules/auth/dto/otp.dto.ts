import { IsEmail, IsIn, IsNotEmpty, IsString, Length } from "class-validator";

export class SendOtpDto {
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsIn(['email_verification', 'password_reset'])
    purpose: 'email_verification' | 'password_reset';
}

export class VerifyOtpDto {
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    @Length(4, 8)
    otp: string;
}