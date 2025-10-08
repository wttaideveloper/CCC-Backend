import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { SetPasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';
import { RefreshTokenDto } from './dto/token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { BaseResponse } from 'src/shared/interfaces/base-response.interface';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    async login(@Body() dto: LoginDto): Promise<BaseResponse<LoginResponseDto>> {
        const { email, password } = dto;
        const loginDetails = await this.authService.login(email, password);
        return {
            success: true,
            message: 'Login successful',
            data: loginDetails
        }
    }

    @Post('send-otp')
    async sendOtp(@Body() dto: SendOtpDto): Promise<BaseResponse<null>> {
        await this.authService.sendOtp(dto.email, dto.purpose);
        return {
            success: true,
            message: 'OTP sent successfully',
            data: null
        };
    }

    @Post('verify-otp')
    async verifyOtp(@Body() dto: VerifyOtpDto): Promise<BaseResponse<null>> {
        await this.authService.verifyOtp(dto.email, dto.otp);
        return {
            success: true,
            message: 'OTP verified successfully',
            data: null
        };
    }

    @Post('set-password')
    async setPassword(@Body() dto: SetPasswordDto): Promise<BaseResponse<null>> {
        await this.authService.setPassword(dto.email, dto.password, dto.confirmPassword);
        return {
            success: true,
            message: 'Password set successfully',
            data: null
        };
    }

    @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<BaseResponse<null>> {
        await this.authService.forgotPassword(dto.email);
        return {
            success: true,
            message: 'Password reset OTP sent successfully',
            data: null
        };
    }

    @Post('reset-password')
    async resetPassword(@Body() dto: ResetPasswordDto): Promise<BaseResponse<null>> {
        await this.authService.resetPassword(dto.email, dto.otp, dto.newPassword, dto.confirmPassword);
        return {
            success: true,
            message: 'Password reset successfully',
            data: null
        };
    }

    @Post('refresh-token')
    async refresh(@Body() dto: RefreshTokenDto): Promise<BaseResponse<LoginResponseDto>> {
        const tokens = await this.authService.refreshToken(dto.refreshToken);
        return {
            success: true,
            message: 'Token refreshed successfully',
            data: tokens
        };
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(@Req() req: any): Promise<BaseResponse<null>> {
        const user = req.user;
        await this.authService.logout(user.userId);
        return {
            success: true,
            message: 'Logged out successfully',
            data: null
        };
    }
}
