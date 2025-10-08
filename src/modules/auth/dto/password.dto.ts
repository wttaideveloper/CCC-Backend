import { IsEmail, IsNotEmpty, Length, MinLength } from "class-validator";

export class ForgotPasswordDto {
    @IsEmail()
    email: string;
}

export class SetPasswordDto extends ForgotPasswordDto {
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @IsNotEmpty()
    @MinLength(6)
    confirmPassword: string;
}

export class ResetPasswordDto extends ForgotPasswordDto {
    @IsNotEmpty()
    @Length(4, 8)
    otp: string;

    @IsNotEmpty()
    @MinLength(6)
    newPassword: string;

    @IsNotEmpty()
    @MinLength(6)
    confirmPassword: string;
}