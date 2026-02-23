import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
    private transporter;
    private mailFrom: string;
    private mailFromName: string;

    constructor(private readonly configService: ConfigService) {
        const mailHost = this.configService.get<string>('mail.host');
        const mailPort = this.configService.get<number>('mail.port');
        const mailUser = this.configService.get<string>('mail.user');
        const mailPass = this.configService.get<string>('mail.pass');
        this.mailFrom = this.configService.get<string>('mail.from') || mailUser || '';
        this.mailFromName = this.configService.get<string>('mail.fromName') || 'Support Team';

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
            from: `"${this.mailFromName}" <${this.mailFrom}>`,
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

    async sendAppointmentConfirmation(opts: {
        to: string;
        recipientName: string;
        otherPartyName: string;
        role: 'pastor' | 'mentor';
        meetingDate: Date;
        durationMinutes: number;
        joinUrl: string;
        password?: string;
        meetingId?: string;
    }) {
        const dateStr = opts.meetingDate.toUTCString();
        const subject = 'Appointment Confirmed – Zoom Meeting Details';

        const zoomBlock = `
            <tr>
                <td style="padding:8px 0;color:#555;font-size:14px;"><b>Zoom Join Link:</b></td>
                <td style="padding:8px 0;"><a href="${opts.joinUrl}" style="color:#2563eb;">${opts.joinUrl}</a></td>
            </tr>
            ${opts.meetingId ? `<tr><td style="padding:8px 0;color:#555;font-size:14px;"><b>Meeting ID:</b></td><td style="padding:8px 0;font-size:14px;">${opts.meetingId}</td></tr>` : ''}
            ${opts.password ? `<tr><td style="padding:8px 0;color:#555;font-size:14px;"><b>Passcode:</b></td><td style="padding:8px 0;font-size:14px;">${opts.password}</td></tr>` : ''}
        `;

        const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div style="background:#1e3a5f;padding:24px 32px;">
                <h2 style="color:#fff;margin:0;font-size:20px;">The Center for Community Change</h2>
                <p style="color:#93c5fd;margin:4px 0 0;font-size:14px;">Appointment Confirmation</p>
            </div>
            <div style="padding:32px;">
                <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi <b>${opts.recipientName}</b>,</p>
                <p style="font-size:14px;color:#374151;margin:0 0 24px;">
                    Your appointment with <b>${opts.otherPartyName}</b> has been confirmed. Here are your meeting details:
                </p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                    <tr>
                        <td style="padding:8px 0;color:#555;font-size:14px;width:140px;"><b>Date &amp; Time:</b></td>
                        <td style="padding:8px 0;font-size:14px;">${dateStr}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;color:#555;font-size:14px;"><b>Duration:</b></td>
                        <td style="padding:8px 0;font-size:14px;">${opts.durationMinutes} minutes</td>
                    </tr>
                    ${zoomBlock}
                </table>
                <a href="${opts.joinUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;">Join Zoom Meeting</a>
                <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">If you have any questions, please contact your program coordinator.</p>
            </div>
        </div>`;

        const text = `Hi ${opts.recipientName},\n\nYour appointment with ${opts.otherPartyName} is confirmed.\nDate: ${dateStr}\nDuration: ${opts.durationMinutes} minutes\nZoom Link: ${opts.joinUrl}${opts.meetingId ? `\nMeeting ID: ${opts.meetingId}` : ''}${opts.password ? `\nPasscode: ${opts.password}` : ''}\n\nThe Center for Community Change`;

        await this.sendMail(opts.to, subject, text, html);
    }

    async sendAppointmentCancellation(opts: {
        to: string;
        recipientName: string;
        otherPartyName: string;
        meetingDate: Date;
        reason?: string;
    }) {
        const dateStr = opts.meetingDate.toUTCString();
        const subject = 'Appointment Cancelled';

        const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div style="background:#1e3a5f;padding:24px 32px;">
                <h2 style="color:#fff;margin:0;font-size:20px;">The Center for Community Change</h2>
                <p style="color:#fca5a5;margin:4px 0 0;font-size:14px;">Appointment Cancelled</p>
            </div>
            <div style="padding:32px;">
                <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi <b>${opts.recipientName}</b>,</p>
                <p style="font-size:14px;color:#374151;margin:0 0 16px;">
                    Your appointment with <b>${opts.otherPartyName}</b> scheduled for <b>${dateStr}</b> has been cancelled.
                </p>
                ${opts.reason ? `<p style="font-size:14px;color:#374151;margin:0 0 16px;"><b>Reason:</b> ${opts.reason}</p>` : ''}
                <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">Please reach out to your coordinator to reschedule.</p>
            </div>
        </div>`;

        const text = `Hi ${opts.recipientName},\n\nYour appointment with ${opts.otherPartyName} on ${dateStr} has been cancelled.${opts.reason ? `\nReason: ${opts.reason}` : ''}\n\nThe Center for Community Change`;

        await this.sendMail(opts.to, subject, text, html);
    }

    async sendAppointmentRescheduled(opts: {
        to: string;
        recipientName: string;
        otherPartyName: string;
        newMeetingDate: Date;
        durationMinutes: number;
        joinUrl: string;
        password?: string;
        meetingId?: string;
    }) {
        const dateStr = opts.newMeetingDate.toUTCString();
        const subject = 'Appointment Rescheduled – Updated Zoom Details';

        const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div style="background:#1e3a5f;padding:24px 32px;">
                <h2 style="color:#fff;margin:0;font-size:20px;">The Center for Community Change</h2>
                <p style="color:#fde68a;margin:4px 0 0;font-size:14px;">Appointment Rescheduled</p>
            </div>
            <div style="padding:32px;">
                <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi <b>${opts.recipientName}</b>,</p>
                <p style="font-size:14px;color:#374151;margin:0 0 24px;">
                    Your appointment with <b>${opts.otherPartyName}</b> has been rescheduled. Updated details:
                </p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                    <tr>
                        <td style="padding:8px 0;color:#555;font-size:14px;width:140px;"><b>New Date &amp; Time:</b></td>
                        <td style="padding:8px 0;font-size:14px;">${dateStr}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;color:#555;font-size:14px;"><b>Duration:</b></td>
                        <td style="padding:8px 0;font-size:14px;">${opts.durationMinutes} minutes</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;color:#555;font-size:14px;"><b>Zoom Join Link:</b></td>
                        <td style="padding:8px 0;"><a href="${opts.joinUrl}" style="color:#2563eb;">${opts.joinUrl}</a></td>
                    </tr>
                    ${opts.meetingId ? `<tr><td style="padding:8px 0;color:#555;font-size:14px;"><b>Meeting ID:</b></td><td style="padding:8px 0;font-size:14px;">${opts.meetingId}</td></tr>` : ''}
                    ${opts.password ? `<tr><td style="padding:8px 0;color:#555;font-size:14px;"><b>Passcode:</b></td><td style="padding:8px 0;font-size:14px;">${opts.password}</td></tr>` : ''}
                </table>
                <a href="${opts.joinUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;">Join Zoom Meeting</a>
                <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">If you have any questions, please contact your program coordinator.</p>
            </div>
        </div>`;

        const text = `Hi ${opts.recipientName},\n\nYour appointment with ${opts.otherPartyName} has been rescheduled.\nNew Date: ${dateStr}\nDuration: ${opts.durationMinutes} minutes\nZoom Link: ${opts.joinUrl}${opts.meetingId ? `\nMeeting ID: ${opts.meetingId}` : ''}${opts.password ? `\nPasscode: ${opts.password}` : ''}\n\nThe Center for Community Change`;

        await this.sendMail(opts.to, subject, text, html);
    }
}
