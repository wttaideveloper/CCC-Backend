import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
    private transporter;
    private mailUser: string;

    constructor(private readonly configService: ConfigService) {
        const mailHost = this.configService.get<string>('mail.host');
        const mailPort = this.configService.get<number>('mail.port');
        const mailUser = this.configService.get<string>('mail.user');
        const mailPass = this.configService.get<string>('mail.pass');

        this.mailUser = mailUser || '';

        this.transporter = nodemailer.createTransport({
            host: mailHost,
            port: mailPort,
            secure: false,
            auth: {
                user: mailUser,
                pass: mailPass,
            },
        });
    }

    async sendMail(to: string, subject: string, text: string, html?: string) {
        await this.transporter.sendMail({
            from: `"Support Team" <${this.mailUser}>`,
            to,
            subject,
            text,
            html,
        });
    }

    async sendOtpEmail(email: string, otp: string) {
        const subject = 'Your OTP Code';
        const text = `Your OTP code is ${otp}. It will expire in 10 minutes.`;
        const html = `<p>Your OTP code is <b>${otp}</b>. It will expire in 10 minutes.</p>`;
        await this.sendMail(email, subject, text, html);
    }
}
