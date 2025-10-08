import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
    private transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST || 'smtp.gmail.com',
            port: Number(process.env.MAIL_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
        });
    }

    async sendMail(to: string, subject: string, text: string, html?: string) {
        await this.transporter.sendMail({
            from: `"Support Team" <${process.env.MAIL_USER}>`,
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
