import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";

@Injectable()
export class GoogleCalendarService {
    constructor(private configService: ConfigService) { }

    // Create client per user (NO shared state)
    private createOAuthClient(user: any) {
        const client = new google.auth.OAuth2(
            this.configService.get("GOOGLE_CLIENT_ID"),
            this.configService.get("GOOGLE_CLIENT_SECRET"),
            this.configService.get("GOOGLE_REDIRECT_URI")
        );

        client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken,
            expiry_date: user.googleTokenExpiry,
        });

        return client;
    }

    private getCalendar(user: any) {
        const auth = this.createOAuthClient(user);

        return google.calendar({
            version: "v3",
            auth,
        });
    }

    getAuthUrl(userId: string) {
        return new google.auth.OAuth2(
            this.configService.get("GOOGLE_CLIENT_ID"),
            this.configService.get("GOOGLE_CLIENT_SECRET"),
            this.configService.get("GOOGLE_REDIRECT_URI")
        ).generateAuthUrl({
            access_type: "offline",
            scope: ["https://www.googleapis.com/auth/calendar"],
            prompt: "consent",
            state: userId,
        });
    }

    async getTokens(code: string): Promise<{
        access_token?: string;
        refresh_token?: string;
        expiry_date?: number;
    }> {
        const client = new google.auth.OAuth2(
            this.configService.get("GOOGLE_CLIENT_ID"),
            this.configService.get("GOOGLE_CLIENT_SECRET"),
            this.configService.get("GOOGLE_REDIRECT_URI")
        );

        const { tokens } = await client.getToken(code);

        return {
            access_token: tokens.access_token ?? undefined,
            refresh_token: tokens.refresh_token ?? undefined,
            expiry_date: tokens.expiry_date ?? undefined,
        };
    }

    async checkAvailability(user: any, start: string, end: string) {
        const calendar = this.getCalendar(user);

        const res = await calendar.events.list({
            calendarId: "primary",
            timeMin: start,
            timeMax: end,
            singleEvents: true,
            orderBy: "startTime",
        });

        return res.data.items?.length === 0;
    }

    // Create event
    async createEvent(user: any, data: {
        title: string;
        description?: string;
        start: string;
        end: string;
    }) {
        const calendar = this.getCalendar(user);

        const res = await calendar.events.insert({
            calendarId: "primary",
            requestBody: {
                summary: data.title,
                description: data.description,
                start: {
                    dateTime: data.start,
                    timeZone: "Asia/Kolkata",
                },
                end: {
                    dateTime: data.end,
                    timeZone: "Asia/Kolkata",
                },
            },
        });

        return res.data;
    }

    // Update event
    async updateEvent(user: any, eventId: string, start: string, end: string) {
        const calendar = this.getCalendar(user);

        await calendar.events.update({
            calendarId: "primary",
            eventId,
            requestBody: {
                start: {
                    dateTime: start,
                    timeZone: "Asia/Kolkata",
                },
                end: {
                    dateTime: end,
                    timeZone: "Asia/Kolkata",
                },
            },
        });
    }

    async deleteEvent(user: any, eventId: string) {
        const calendar = this.getCalendar(user);

        await calendar.events.delete({
            calendarId: "primary",
            eventId,
        });
    }
}