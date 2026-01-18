import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Appointment, AppointmentDocument } from '../appointments/schemas/appointment.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CalendlyEventLog, CalendlyEventDocument } from './schemas/calendly-event.schema';
import { CalendlyWebhookPayload } from './dto/calendly-webhook.dto';
import { MailerService } from '../../common/utils/mail.util';
import { HomeService } from '../home/home.service';
import { EncryptionService } from '../../common/utils/encryption.util';
import { APPOINTMENT_STATUSES, APPOINTMENT_PLATFORMS } from '../../common/constants/status.constants';
import { ROLES } from '../../common/constants/roles.constants';
import * as crypto from 'crypto';

@Injectable()
export class CalendlyService {
    private readonly logger = new Logger(CalendlyService.name);
    private readonly calendlyApiBaseUrl = 'https://api.calendly.com';
    private readonly calendlyAuthUrl = 'https://auth.calendly.com/oauth';

    constructor(
        @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(CalendlyEventLog.name) private calendlyEventModel: Model<CalendlyEventDocument>,
        private readonly mailerService: MailerService,
        private readonly notificationService: HomeService,
        private readonly configService: ConfigService,
        private readonly encryptionService: EncryptionService,
    ) {}

    /**
     * Verify Calendly webhook signature
     */
    verifyWebhookSignature(signature: string, body: string, secret: string): boolean {
        try {
            const hash = crypto
                .createHmac('sha256', secret)
                .update(body)
                .digest('base64');
            return hash === signature;
        } catch (error) {
            this.logger.error('Error verifying webhook signature:', error);
            return false;
        }
    }

    /**
     * Main webhook handler
     */
    async handleWebhook(webhookData: CalendlyWebhookPayload): Promise<any> {
        const { event, payload } = webhookData;

        // Log the webhook event
        const eventLog = await this.calendlyEventModel.create({
            eventType: event,
            calendlyEventUri: payload.event?.uri || '',
            calendlyInviteeUri: payload.invitee?.uri || '',
            rawPayload: webhookData,
            status: 'received',
            receivedAt: new Date(),
        });

        try {
            let result;
            switch (event) {
                case 'invitee.created':
                    result = await this.handleAppointmentCreated(payload);
                    break;
                case 'invitee.canceled':
                    result = await this.handleAppointmentCanceled(payload);
                    break;
                case 'invitee.rescheduled':
                    result = await this.handleAppointmentRescheduled(payload);
                    break;
                default:
                    this.logger.warn(`Unhandled webhook event: ${event}`);
                    result = { message: `Event ${event} received but not processed` };
            }

            // Update event log as processed
            await this.calendlyEventModel.findByIdAndUpdate(eventLog._id, {
                status: 'processed',
                processedAt: new Date(),
                appointmentId: result?.appointmentId,
            });

            return result;
        } catch (error) {
            this.logger.error(`Error processing webhook event ${event}:`, error);

            // Update event log as failed
            await this.calendlyEventModel.findByIdAndUpdate(eventLog._id, {
                status: 'failed',
                errorMessage: error.message,
                processedAt: new Date(),
            });

            throw error;
        }
    }

    /**
     * Handle appointment created event
     */
    private async handleAppointmentCreated(payload: any): Promise<any> {
        const { event, invitee, questions_and_answers } = payload;

        // Find mentor by Calendly event URI (stored in their calendlyConfig)
        const mentor = await this.findUserByCalendlyEvent(event.uri);
        if (!mentor) {
            throw new NotFoundException('Mentor not found for this Calendly event');
        }

        // Find student by email
        const student = await this.userModel.findOne({ email: invitee.email });
        if (!student) {
            throw new NotFoundException(`User not found with email: ${invitee.email}`);
        }

        // Check if appointment already exists
        const existingAppointment = await this.appointmentModel.findOne({
            calendlyEventUri: event.uri,
            calendlyInviteeUri: invitee.uri,
        });

        if (existingAppointment) {
            this.logger.warn('Appointment already exists for this Calendly event');
            return { appointmentId: existingAppointment._id, status: 'already_exists' };
        }

        // Extract Zoom meeting details if present (from Calendly's Zoom integration)
        let zoomMeetingId: string | null = null;
        let zoomMetadata: any = null;
        let meetingLink = event.location?.join_url || event.uri;

        // Check if location is Zoom and extract meeting ID
        if (event.location?.type === 'zoom' || event.location?.join_url?.includes('zoom.us')) {
            const zoomUrl = event.location.join_url;
            // Extract Zoom meeting ID from URL (format: https://zoom.us/j/1234567890)
            const meetingIdMatch = zoomUrl?.match(/\/j\/(\d+)/);
            if (meetingIdMatch) {
                zoomMeetingId = meetingIdMatch[1];
                zoomMetadata = {
                    meetingId: zoomMeetingId,
                    joinUrl: zoomUrl,
                    password: event.location.data?.password,
                    createdBy: 'calendly',
                    createdAt: new Date(),
                };
                meetingLink = zoomUrl;
                this.logger.log(`Extracted Zoom meeting ID ${zoomMeetingId} from Calendly event`);
            }
        }

        // Create appointment in database
        const appointment = await this.appointmentModel.create({
            userId: student._id,
            mentorId: mentor._id,
            meetingDate: new Date(event.start_time),
            endTime: new Date(event.end_time),
            platform: zoomMeetingId ? APPOINTMENT_PLATFORMS.ZOOM : APPOINTMENT_PLATFORMS.CALENDLY,
            meetingLink,
            status: APPOINTMENT_STATUSES.SCHEDULED,
            source: 'calendly',
            calendlyEventUri: event.uri,
            calendlyInviteeUri: invitee.uri,
            zoomMeetingId,
            zoomMetadata,
            calendlyMetadata: {
                eventTypeUri: event.event_type,
                eventTypeName: event.name,
                inviteeName: invitee.name,
                inviteeEmail: invitee.email,
                location: event.location,
                questionsAndAnswers: questions_and_answers || [],
            },
        });

        // Send emails to all parties
        await this.sendAppointmentCreatedEmails(student, mentor, appointment);

        // Add in-app notifications
        await this.addAppointmentNotifications(student, mentor, appointment, 'created');

        return { appointmentId: appointment._id, status: 'created' };
    }

    /**
     * Handle appointment canceled event
     */
    private async handleAppointmentCanceled(payload: any): Promise<any> {
        const { event, invitee } = payload;

        // Find the appointment
        const appointment = await this.appointmentModel.findOne({
            calendlyEventUri: event.uri,
            calendlyInviteeUri: invitee.uri,
        }).populate('userId mentorId');

        if (!appointment) {
            throw new NotFoundException('Appointment not found for this Calendly event');
        }

        // Update appointment status
        const cancelReason = invitee.cancellation?.reason || 'Canceled via Calendly';
        const updatedAppointment = await this.appointmentModel.findByIdAndUpdate(
            appointment._id,
            {
                status: APPOINTMENT_STATUSES.CANCELED,
                canceledAt: new Date(),
                cancelReason,
            },
            { new: true }
        ).populate('userId mentorId');

        // Send cancellation emails
        // await this.sendAppointmentCanceledEmails(
        //     updatedAppointment.userId as any,
        //     updatedAppointment.mentorId as any,
        //     updatedAppointment,
        //     cancelReason
        // );

        // // Add in-app notifications
        // await this.addAppointmentNotifications(
        //     updatedAppointment.userId as any,
        //     updatedAppointment.mentorId as any,
        //     updatedAppointment,
        //     'canceled'
        // );

        return { appointmentId: appointment._id, status: 'canceled' };
    }

    /**
     * Handle appointment rescheduled event
     */
    private async handleAppointmentRescheduled(payload: any): Promise<any> {
        const { event, invitee, old_event, old_invitee } = payload;

        // Find the appointment using old event URIs
        const appointment = await this.appointmentModel.findOne({
            calendlyEventUri: old_event?.uri || event.uri,
            calendlyInviteeUri: old_invitee?.uri || invitee.uri,
        }).populate('userId mentorId');

        if (!appointment) {
            throw new NotFoundException('Appointment not found for this Calendly event');
        }

        // Update appointment with new times and URIs
        const updatedAppointment = await this.appointmentModel.findByIdAndUpdate(
            appointment._id,
            {
                meetingDate: new Date(event.start_time),
                endTime: new Date(event.end_time),
                calendlyEventUri: event.uri,
                calendlyInviteeUri: invitee.uri,
                meetingLink: event.location?.join_url || event.uri,
                status: APPOINTMENT_STATUSES.SCHEDULED,
                'calendlyMetadata.eventTypeUri': event.event_type,
                'calendlyMetadata.eventTypeName': event.name,
                'calendlyMetadata.location': event.location,
            },
            { new: true }
        ).populate('userId mentorId');

        if (!updatedAppointment) {
            throw new NotFoundException('Failed to update appointment');
        }

        // Send rescheduled notification emails
        const meetingDateFormatted = new Date(updatedAppointment.meetingDate).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        const student = updatedAppointment.userId as any;
        const mentor = updatedAppointment.mentorId as any;

        // Send email to student
        try {
            await this.mailerService.sendMail(
                student.email,
                'Appointment Rescheduled',
                `Your appointment with ${mentor.firstName} ${mentor.lastName} has been rescheduled to ${meetingDateFormatted}`,
                this.getAppointmentRescheduledHtml(student, mentor, updatedAppointment, meetingDateFormatted)
            );
        } catch (error) {
            this.logger.error('Error sending rescheduled email to student:', error);
        }

        // Send email to mentor
        try {
            await this.mailerService.sendMail(
                mentor.email,
                'Appointment Rescheduled',
                `${student.firstName} ${student.lastName}'s appointment has been rescheduled to ${meetingDateFormatted}`,
                this.getMentorRescheduledHtml(student, mentor, updatedAppointment, meetingDateFormatted)
            );
        } catch (error) {
            this.logger.error('Error sending rescheduled email to mentor:', error);
        }

        // Add in-app notifications
        const meetingIso = updatedAppointment.meetingDate.toISOString();
        try {
            await this.notificationService.addNotification({
                userId: student._id.toString(),
                name: 'APPOINTMENT_RESCHEDULED',
                details: `Your appointment with ${mentor.firstName} ${mentor.lastName} has been rescheduled to ${meetingIso}.`,
                module: 'APPOINTMENT'
            });

            await this.notificationService.addNotification({
                userId: mentor._id.toString(),
                name: 'APPOINTMENT_RESCHEDULED',
                details: `${student.firstName} ${student.lastName} rescheduled their appointment to ${meetingIso}.`,
                module: 'APPOINTMENT'
            });

            await this.notificationService.addNotification({
                role: ROLES.DIRECTOR,
                name: 'APPOINTMENT_RESCHEDULED',
                details: `${student.firstName} ${student.lastName}'s appointment with ${mentor.firstName} ${mentor.lastName} was rescheduled to ${meetingIso}.`,
                module: 'APPOINTMENT'
            });
        } catch (error) {
            this.logger.error('Error adding rescheduled notifications:', error);
        }

        return { appointmentId: appointment._id, status: 'rescheduled' };
    }

    /**
     * Find user (mentor/director) by Calendly event URI
     */
    private async findUserByCalendlyEvent(eventUri: string): Promise<UserDocument | null> {
        // Extract the event type from URI (e.g., https://api.calendly.com/event_types/XXXXX)
        const eventTypeMatch = eventUri.match(/event_types\/([^/]+)/);
        if (!eventTypeMatch) {
            return null;
        }

        const eventTypeId = eventTypeMatch[1];

        // Find user with this event type in their calendlyConfig
        const user = await this.userModel.findOne({
            'calendlyConfig.eventTypes.url': { $regex: eventTypeId }
        });

        return user;
    }

    /**
     * Send appointment created emails
     */
    private async sendAppointmentCreatedEmails(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument
    ): Promise<void> {
        const meetingDateFormatted = new Date(appointment.meetingDate).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        // Email to student
        try {
            await this.mailerService.sendMail(
                student.email,
                'Appointment Confirmed',
                `Your appointment with ${mentor.firstName} ${mentor.lastName} is confirmed for ${meetingDateFormatted}`,
                this.getAppointmentCreatedHtml(student, mentor, appointment, meetingDateFormatted)
            );
        } catch (error) {
            this.logger.error('Error sending email to student:', error);
        }

        // Email to mentor
        try {
            await this.mailerService.sendMail(
                mentor.email,
                'New Appointment Scheduled',
                `${student.firstName} ${student.lastName} has scheduled an appointment with you for ${meetingDateFormatted}`,
                this.getMentorAppointmentHtml(student, mentor, appointment, meetingDateFormatted)
            );
        } catch (error) {
            this.logger.error('Error sending email to mentor:', error);
        }

        // Email to directors
        try {
            const directors = await this.userModel.find({ role: ROLES.DIRECTOR });
            for (const director of directors) {
                await this.mailerService.sendMail(
                    director.email,
                    'Appointment Notification',
                    `${student.firstName} ${student.lastName} scheduled an appointment with ${mentor.firstName} ${mentor.lastName}`,
                    this.getDirectorNotificationHtml(student, mentor, appointment, meetingDateFormatted)
                );
            }
        } catch (error) {
            this.logger.error('Error sending emails to directors:', error);
        }
    }

    /**
     * Send appointment canceled emails
     */
    private async sendAppointmentCanceledEmails(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument,
        reason: string
    ): Promise<void> {
        const meetingDateFormatted = new Date(appointment.meetingDate).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        // Email to student
        try {
            await this.mailerService.sendMail(
                student.email,
                'Appointment Canceled',
                `Your appointment with ${mentor.firstName} ${mentor.lastName} on ${meetingDateFormatted} has been canceled`,
                this.getAppointmentCanceledHtml(student, mentor, appointment, meetingDateFormatted, reason)
            );
        } catch (error) {
            this.logger.error('Error sending cancellation email to student:', error);
        }

        // Email to mentor
        try {
            await this.mailerService.sendMail(
                mentor.email,
                'Appointment Canceled',
                `${student.firstName} ${student.lastName}'s appointment on ${meetingDateFormatted} has been canceled`,
                this.getMentorCancellationHtml(student, mentor, appointment, meetingDateFormatted, reason)
            );
        } catch (error) {
            this.logger.error('Error sending cancellation email to mentor:', error);
        }

        // Email to directors
        try {
            const directors = await this.userModel.find({ role: ROLES.DIRECTOR });
            for (const director of directors) {
                await this.mailerService.sendMail(
                    director.email,
                    'Appointment Canceled',
                    `Appointment between ${student.firstName} ${student.lastName} and ${mentor.firstName} ${mentor.lastName} was canceled`,
                    this.getDirectorCancellationHtml(student, mentor, appointment, meetingDateFormatted, reason)
                );
            }
        } catch (error) {
            this.logger.error('Error sending cancellation emails to directors:', error);
        }
    }

    /**
     * Add in-app notifications
     */
    private async addAppointmentNotifications(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument,
        eventType: 'created' | 'canceled'
    ): Promise<void> {
        const meetingIso = appointment.meetingDate.toISOString();

        try {
            if (eventType === 'created') {
                // Notification to student
                await this.notificationService.addNotification({
                    userId: student._id.toString(),
                    name: 'APPOINTMENT_SCHEDULED',
                    details: `Your appointment with ${mentor.firstName} ${mentor.lastName} is scheduled at ${meetingIso}.`,
                    module: 'APPOINTMENT'
                });

                // Notification to mentor
                await this.notificationService.addNotification({
                    userId: mentor._id.toString(),
                    name: 'NEW_APPOINTMENT',
                    details: `${student.firstName} ${student.lastName} has booked an appointment with you at ${meetingIso}.`,
                    module: 'APPOINTMENT'
                });

                // Notification to directors
                await this.notificationService.addNotification({
                    role: ROLES.DIRECTOR,
                    name: 'APPOINTMENT_BOOKED',
                    details: `${student.firstName} ${student.lastName} booked an appointment with ${mentor.firstName} ${mentor.lastName} at ${meetingIso}.`,
                    module: 'APPOINTMENT'
                });
            } else if (eventType === 'canceled') {
                // Notification to student
                await this.notificationService.addNotification({
                    userId: student._id.toString(),
                    name: 'APPOINTMENT_CANCELED',
                    details: `Your appointment with ${mentor.firstName} ${mentor.lastName} on ${meetingIso} has been canceled.`,
                    module: 'APPOINTMENT'
                });

                // Notification to mentor
                await this.notificationService.addNotification({
                    userId: mentor._id.toString(),
                    name: 'APPOINTMENT_CANCELED',
                    details: `${student.firstName} ${student.lastName} canceled their appointment scheduled at ${meetingIso}.`,
                    module: 'APPOINTMENT'
                });

                // Notification to directors
                await this.notificationService.addNotification({
                    role: ROLES.DIRECTOR,
                    name: 'APPOINTMENT_CANCELED',
                    details: `${student.firstName} ${student.lastName}'s appointment with ${mentor.firstName} ${mentor.lastName} on ${meetingIso} was canceled.`,
                    module: 'APPOINTMENT'
                });
            }
        } catch (error) {
            this.logger.error('Error adding notifications:', error);
        }
    }

    /**
     * Get mentor's Calendly booking link
     */
    // async getMentorBookingLink(mentorId: string, targetRole?: string): Promise<string | null> {
    //     const mentor = await this.userModel.findById(mentorId).select('calendlyConfig');
    //     if (!mentor || !mentor.calendlyConfig) {
    //         return null;
    //     }

    //     // If targetRole is specified, find specific event type
    //     if (targetRole && mentor.calendlyConfig.eventTypes) {
    //         const eventType = mentor.calendlyConfig.eventTypes.find(
    //             et => et.targetRole === targetRole
    //         );
    //         return eventType?.url || null;
    //     }

    //     // Return first available event type
    //     return mentor.calendlyConfig.eventTypes?.[0]?.url || null;
    // }

    /**
     * Generate Calendly OAuth authorization URL
     */
    generateOAuthUrl(userId: string, state?: string): string {
        const params = new URLSearchParams({
            client_id: this.configService.get('CALENDLY_CLIENT_ID') || '',
            response_type: 'code',
            redirect_uri: this.configService.get('CALENDLY_REDIRECT_URI') || '',
            state: state || userId,
        });
        return `${this.calendlyAuthUrl}/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string): Promise<any> {
        const response = await fetch(`${this.calendlyAuthUrl}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: this.configService.get('CALENDLY_CLIENT_ID'),
                client_secret: this.configService.get('CALENDLY_CLIENT_SECRET'),
                redirect_uri: this.configService.get('CALENDLY_REDIRECT_URI'),
                code,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to exchange Calendly code for token:', error);
            throw new BadRequestException('Failed to authenticate with Calendly');
        }

        return response.json();
    }

    /**
     * Refresh expired access token
     */
    async refreshAccessToken(refreshToken: string): Promise<any> {
        const response = await fetch(`${this.calendlyAuthUrl}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                client_id: this.configService.get('CALENDLY_CLIENT_ID'),
                client_secret: this.configService.get('CALENDLY_CLIENT_SECRET'),
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to refresh Calendly token:', error);
            throw new BadRequestException('Failed to refresh Calendly token');
        }

        return response.json();
    }

    /**
     * Get valid access token, refreshing if necessary
     */
    async getValidAccessToken(user: UserDocument): Promise<string> {
        if (!user.calendlyConfig?.accessToken) {
            throw new BadRequestException('User has not connected Calendly account');
        }

        // Decrypt token
        const decryptedToken = this.encryptionService.decrypt(user.calendlyConfig.accessToken);

        // Check if token is expired or expiring soon (within 5 minutes)
        const expiresAt = user.calendlyConfig.tokenExpiresAt;
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        if (expiresAt && new Date(expiresAt) <= fiveMinutesFromNow) {
            this.logger.log(`Refreshing expired Calendly token for user ${user._id}`);

            const decryptedRefreshToken = this.encryptionService.decrypt(user.calendlyConfig.refreshToken);
            const tokenData = await this.refreshAccessToken(decryptedRefreshToken);

            // Update user with new tokens
            await this.updateUserCalendlyTokens(user._id.toString(), tokenData);

            return tokenData.access_token;
        }

        return decryptedToken;
    }

    /**
     * Update user's Calendly tokens
     */
    private async updateUserCalendlyTokens(userId: string, tokenData: any): Promise<void> {
        const encryptedAccessToken = this.encryptionService.encrypt(tokenData.access_token);
        const encryptedRefreshToken = this.encryptionService.encrypt(tokenData.refresh_token);

        await this.userModel.findByIdAndUpdate(userId, {
            'calendlyConfig.accessToken': encryptedAccessToken,
            'calendlyConfig.refreshToken': encryptedRefreshToken,
            'calendlyConfig.tokenExpiresAt': new Date(Date.now() + tokenData.expires_in * 1000),
            'calendlyConfig.lastSyncedAt': new Date(),
        });
    }

    /**
     * Connect Calendly account for a user
     */
    async connectCalendlyAccount(userId: string, code: string): Promise<UserDocument> {
        const tokenData = await this.exchangeCodeForToken(code);

        // Get user info from Calendly
        const userInfo = await this.getCalendlyUserInfo(tokenData.access_token);

        // Fetch user's event types
        const eventTypes = await this.fetchUserEventTypes(tokenData.access_token, userInfo.resource.uri);

        // Encrypt tokens before storing
        const encryptedAccessToken = this.encryptionService.encrypt(tokenData.access_token);
        const encryptedRefreshToken = this.encryptionService.encrypt(tokenData.refresh_token);

        const user = await this.userModel.findByIdAndUpdate(
            userId,
            {
                calendlyConfig: {
                    calendlyUsername: userInfo.resource.name,
                    calendlyUserUri: userInfo.resource.uri,
                    organizationUri: userInfo.resource.current_organization,
                    accessToken: encryptedAccessToken,
                    refreshToken: encryptedRefreshToken,
                    tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
                    eventTypes: eventTypes.map((et: any) => ({
                        uuid: et.uri.split('/').pop(),
                        name: et.name,
                        url: et.scheduling_url,
                        duration: et.duration,
                        targetRole: '', // Admin will configure this
                        active: et.active,
                        pooling: et.pooling_type === 'round_robin',
                        color: et.color,
                    })),
                    connectedAt: new Date(),
                    lastSyncedAt: new Date(),
                },
            },
            { new: true }
        );

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    /**
     * Get Calendly user information
     */
    async getCalendlyUserInfo(accessToken: string): Promise<any> {
        const response = await fetch(`${this.calendlyApiBaseUrl}/users/me`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to get Calendly user info:', error);
            throw new BadRequestException('Failed to get Calendly user info');
        }

        return response.json();
    }

    /**
     * Fetch user's Calendly event types
     */
    async fetchUserEventTypes(accessToken: string, userUri: string): Promise<any[]> {
        const response = await fetch(
            `${this.calendlyApiBaseUrl}/event_types?user=${userUri}&active=true`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to fetch Calendly event types:', error);
            throw new BadRequestException('Failed to fetch Calendly event types');
        }

        const data = await response.json();
        return data.collection || [];
    }

    /**
     * Get mentor's Calendly booking link by role
     */
    async getMentorBookingLink(mentorId: string, targetRole?: string): Promise<string | null> {
        const mentor = await this.userModel.findById(mentorId).select('calendlyConfig');

        if (!mentor || !mentor.calendlyConfig) {
            return null;
        }

        // If targetRole is specified, find matching event type
        if (targetRole && mentor.calendlyConfig.eventTypes) {
            const eventType = mentor.calendlyConfig.eventTypes.find(
                (et) => et.targetRole === targetRole && et.active
            );
            return eventType?.url || null;
        }

        // Return first active event type
        const activeEvent = mentor.calendlyConfig.eventTypes?.find((et) => et.active);
        return activeEvent?.url || null;
    }

    /**
     * Update user's Calendly configuration
     */
    async updateCalendlyConfig(
        userId: string,
        config: { calendlyUsername: string; eventTypes: any[] }
    ): Promise<UserDocument> {
        const user = await this.userModel.findByIdAndUpdate(
            userId,
            { calendlyConfig: config },
            { new: true, runValidators: true }
        );

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    /**
     * Update event type role mapping
     */
    async updateEventTypeMapping(
        userId: string,
        eventTypeUuid: string,
        targetRole: string,
        internalNote?: string
    ): Promise<UserDocument> {
        const user = await this.userModel.findOneAndUpdate(
            {
                _id: userId,
                'calendlyConfig.eventTypes.uuid': eventTypeUuid,
            },
            {
                $set: {
                    'calendlyConfig.eventTypes.$.targetRole': targetRole,
                    'calendlyConfig.eventTypes.$.internalNote': internalNote,
                },
            },
            { new: true }
        );

        if (!user) {
            throw new NotFoundException('User or event type not found');
        }

        return user;
    }

    /**
     * Sync event types from Calendly
     */
    async syncEventTypes(userId: string): Promise<UserDocument> {
        const user = await this.userModel.findById(userId);
        if (!user || !user.calendlyConfig?.accessToken) {
            throw new BadRequestException('User has not connected Calendly account');
        }

        const accessToken = await this.getValidAccessToken(user);
        const eventTypes = await this.fetchUserEventTypes(accessToken, user.calendlyConfig.calendlyUserUri);

        // Preserve existing role mappings
        const existingMappings = new Map(
            user.calendlyConfig.eventTypes?.map((et) => [et.uuid, { targetRole: et.targetRole, internalNote: et.internalNote }]) || []
        );

        const updatedUser = await this.userModel.findByIdAndUpdate(
            userId,
            {
                'calendlyConfig.eventTypes': eventTypes.map((et: any) => {
                    const uuid = et.uri.split('/').pop();
                    const existing = existingMappings.get(uuid);
                    return {
                        uuid,
                        name: et.name,
                        url: et.scheduling_url,
                        duration: et.duration,
                        targetRole: existing?.targetRole || '',
                        active: et.active,
                        pooling: et.pooling_type === 'round_robin',
                        color: et.color,
                        internalNote: existing?.internalNote,
                    };
                }),
                'calendlyConfig.lastSyncedAt': new Date(),
            },
            { new: true }
        );

        if (!updatedUser) {
            throw new NotFoundException('User not found');
        }

        return updatedUser;
    }

    /**
     * Disconnect Calendly account
     */
    async disconnectCalendlyAccount(userId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            $unset: { calendlyConfig: 1 },
        });

        this.logger.log(`Disconnected Calendly account for user ${userId}`);
    }

    /**
     * Get all mentors with Calendly configured
     */
    async getMentorsWithCalendly(roles?: string[]): Promise<any[]> {
        const query: any = {
            'calendlyConfig.accessToken': { $exists: true },
        };

        if (roles && roles.length > 0) {
            query.role = { $in: roles };
        } else {
            query.role = { $in: [ROLES.MENTOR, ROLES.FIELD_MENTOR, ROLES.DIRECTOR] };
        }

        return this.userModel
            .find(query)
            .select('firstName lastName email role calendlyConfig.eventTypes calendlyConfig.calendlyUsername calendlyConfig.connectedAt')
            .lean()
            .exec();
    }

    // Email HTML templates
    private getAppointmentCreatedHtml(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument,
        dateFormatted: string
    ): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Appointment Confirmed!</h2>
                <p>Hi ${student.firstName},</p>
                <p>Your appointment has been successfully scheduled with the following details:</p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 10px 0;"><strong>Mentor:</strong> ${mentor.firstName} ${mentor.lastName}</p>
                    <p style="margin: 10px 0;"><strong>Date & Time:</strong> ${dateFormatted}</p>
                    <p style="margin: 10px 0;"><strong>Duration:</strong> ${Math.round((appointment.endTime.getTime() - appointment.meetingDate.getTime()) / 60000)} minutes</p>
                    ${appointment.meetingLink ? `<p style="margin: 10px 0;"><strong>Meeting Link:</strong> <a href="${appointment.meetingLink}" style="color: #007bff;">Join Meeting</a></p>` : ''}
                </div>
                <p>If you need to reschedule or cancel, please use your Calendly link or contact the mentor directly.</p>
                <p>Best regards,<br>The Team</p>
            </div>
        `;
    }

    private getMentorAppointmentHtml(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument,
        dateFormatted: string
    ): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">New Appointment Scheduled</h2>
                <p>Hi ${mentor.firstName},</p>
                <p>A new appointment has been scheduled with you:</p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 10px 0;"><strong>Student:</strong> ${student.firstName} ${student.lastName}</p>
                    <p style="margin: 10px 0;"><strong>Email:</strong> ${student.email}</p>
                    <p style="margin: 10px 0;"><strong>Date & Time:</strong> ${dateFormatted}</p>
                    <p style="margin: 10px 0;"><strong>Duration:</strong> ${Math.round((appointment.endTime.getTime() - appointment.meetingDate.getTime()) / 60000)} minutes</p>
                    ${appointment.meetingLink ? `<p style="margin: 10px 0;"><strong>Meeting Link:</strong> <a href="${appointment.meetingLink}" style="color: #007bff;">Join Meeting</a></p>` : ''}
                </div>
                <p>Please prepare for the session and check your calendar.</p>
                <p>Best regards,<br>The Team</p>
            </div>
        `;
    }

    private getDirectorNotificationHtml(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument,
        dateFormatted: string
    ): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Appointment Notification</h2>
                <p>A new appointment has been scheduled:</p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 10px 0;"><strong>Student:</strong> ${student.firstName} ${student.lastName} (${student.email})</p>
                    <p style="margin: 10px 0;"><strong>Mentor:</strong> ${mentor.firstName} ${mentor.lastName} (${mentor.email})</p>
                    <p style="margin: 10px 0;"><strong>Date & Time:</strong> ${dateFormatted}</p>
                    <p style="margin: 10px 0;"><strong>Duration:</strong> ${Math.round((appointment.endTime.getTime() - appointment.meetingDate.getTime()) / 60000)} minutes</p>
                </div>
                <p>This is an automated notification for tracking purposes.</p>
                <p>Best regards,<br>The System</p>
            </div>
        `;
    }

    private getAppointmentCanceledHtml(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument,
        dateFormatted: string,
        reason: string
    ): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #d9534f;">Appointment Canceled</h2>
                <p>Hi ${student.firstName},</p>
                <p>Your appointment with ${mentor.firstName} ${mentor.lastName} has been canceled.</p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 10px 0;"><strong>Canceled Appointment:</strong></p>
                    <p style="margin: 10px 0;"><strong>Date & Time:</strong> ${dateFormatted}</p>
                    <p style="margin: 10px 0;"><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
                </div>
                <p>If you would like to reschedule, please use your Calendly link to book a new appointment.</p>
                <p>Best regards,<br>The Team</p>
            </div>
        `;
    }

    private getMentorCancellationHtml(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument,
        dateFormatted: string,
        reason: string
    ): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #d9534f;">Appointment Canceled</h2>
                <p>Hi ${mentor.firstName},</p>
                <p>An appointment with ${student.firstName} ${student.lastName} has been canceled.</p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 10px 0;"><strong>Student:</strong> ${student.firstName} ${student.lastName}</p>
                    <p style="margin: 10px 0;"><strong>Date & Time:</strong> ${dateFormatted}</p>
                    <p style="margin: 10px 0;"><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
                </div>
                <p>Your calendar has been updated accordingly.</p>
                <p>Best regards,<br>The Team</p>
            </div>
        `;
    }

    private getDirectorCancellationHtml(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument,
        dateFormatted: string,
        reason: string
    ): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #d9534f;">Appointment Canceled</h2>
                <p>An appointment has been canceled:</p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 10px 0;"><strong>Student:</strong> ${student.firstName} ${student.lastName}</p>
                    <p style="margin: 10px 0;"><strong>Mentor:</strong> ${mentor.firstName} ${mentor.lastName}</p>
                    <p style="margin: 10px 0;"><strong>Date & Time:</strong> ${dateFormatted}</p>
                    <p style="margin: 10px 0;"><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
                </div>
                <p>This is an automated notification for tracking purposes.</p>
                <p>Best regards,<br>The System</p>
            </div>
        `;
    }

    private getAppointmentRescheduledHtml(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument,
        dateFormatted: string
    ): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #5bc0de;">Appointment Rescheduled</h2>
                <p>Hi ${student.firstName},</p>
                <p>Your appointment with ${mentor.firstName} ${mentor.lastName} has been rescheduled.</p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 10px 0;"><strong>Mentor:</strong> ${mentor.firstName} ${mentor.lastName}</p>
                    <p style="margin: 10px 0;"><strong>New Date & Time:</strong> ${dateFormatted}</p>
                    <p style="margin: 10px 0;"><strong>Duration:</strong> ${Math.round((appointment.endTime.getTime() - appointment.meetingDate.getTime()) / 60000)} minutes</p>
                    ${appointment.meetingLink ? `<p style="margin: 10px 0;"><strong>Meeting Link:</strong> <a href="${appointment.meetingLink}" style="color: #007bff;">Join Meeting</a></p>` : ''}
                </div>
                <p>Please make note of the new time. If you need to make further changes, please use your Calendly link.</p>
                <p>Best regards,<br>The Team</p>
            </div>
        `;
    }

    private getMentorRescheduledHtml(
        student: UserDocument,
        mentor: UserDocument,
        appointment: AppointmentDocument,
        dateFormatted: string
    ): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #5bc0de;">Appointment Rescheduled</h2>
                <p>Hi ${mentor.firstName},</p>
                <p>An appointment with ${student.firstName} ${student.lastName} has been rescheduled.</p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 10px 0;"><strong>Student:</strong> ${student.firstName} ${student.lastName}</p>
                    <p style="margin: 10px 0;"><strong>Email:</strong> ${student.email}</p>
                    <p style="margin: 10px 0;"><strong>New Date & Time:</strong> ${dateFormatted}</p>
                    <p style="margin: 10px 0;"><strong>Duration:</strong> ${Math.round((appointment.endTime.getTime() - appointment.meetingDate.getTime()) / 60000)} minutes</p>
                    ${appointment.meetingLink ? `<p style="margin: 10px 0;"><strong>Meeting Link:</strong> <a href="${appointment.meetingLink}" style="color: #007bff;">Join Meeting</a></p>` : ''}
                </div>
                <p>Please update your calendar accordingly.</p>
                <p>Best regards,<br>The Team</p>
            </div>
        `;
    }

    /**
     * Fetch availability for a specific user from Calendly
     * Returns available time slots for the next 30 days
     */
    async getUserAvailability(userId: string, eventTypeUuid?: string, startDate?: Date, endDate?: Date): Promise<any> {
        const user = await this.userModel.findById(userId);
        if (!user || !user.calendlyConfig?.accessToken) {
            throw new BadRequestException('User has not connected Calendly account');
        }

        const accessToken = await this.getValidAccessToken(user);

        // If eventTypeUuid not provided, get the first active event type
        let eventTypeUri = '';
        if (eventTypeUuid) {
            const eventType = user.calendlyConfig.eventTypes?.find(et => et.uuid === eventTypeUuid);
            if (!eventType) {
                throw new NotFoundException('Event type not found');
            }
            eventTypeUri = `${this.calendlyApiBaseUrl}/event_types/${eventTypeUuid}`;
        } else if (user.calendlyConfig.eventTypes && user.calendlyConfig.eventTypes.length > 0) {
            const firstActive = user.calendlyConfig.eventTypes.find(et => et.active);
            if (firstActive) {
                eventTypeUri = `${this.calendlyApiBaseUrl}/event_types/${firstActive.uuid}`;
            }
        }

        if (!eventTypeUri) {
            throw new BadRequestException('No active event types found');
        }

        // Default to next 30 days
        const start = startDate || new Date();
        const end = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const params = new URLSearchParams({
            event_type: eventTypeUri,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
        });

        const response = await fetch(
            `${this.calendlyApiBaseUrl}/event_type_available_times?${params.toString()}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to fetch Calendly availability:', error);
            throw new BadRequestException('Failed to fetch availability from Calendly');
        }

        const data = await response.json();
        return data.collection || [];
    }

    /**
     * Get availability for all mentors, directors, and field mentors
     * Returns consolidated availability from Calendly
     */
    async getAllMentorsAvailability(roles?: string[], targetRole?: string): Promise<any[]> {
        const query: any = {
            'calendlyConfig.accessToken': { $exists: true },
        };

        if (roles && roles.length > 0) {
            query.role = { $in: roles };
        } else {
            query.role = { $in: [ROLES.MENTOR, ROLES.FIELD_MENTOR, ROLES.DIRECTOR] };
        }

        const mentors = await this.userModel.find(query).lean();

        const availabilityPromises = mentors.map(async (mentor) => {
            try {
                // Find event type matching target role if specified
                let eventTypeUuid: string | undefined;
                if (targetRole && mentor.calendlyConfig?.eventTypes) {
                    const matchingEvent = mentor.calendlyConfig.eventTypes.find(
                        (et: any) => et.targetRole === targetRole && et.active
                    );
                    eventTypeUuid = matchingEvent?.uuid;
                } else if (mentor.calendlyConfig?.eventTypes) {
                    const firstActive = mentor.calendlyConfig.eventTypes.find((et: any) => et.active);
                    eventTypeUuid = firstActive?.uuid;
                }

                if (!eventTypeUuid) {
                    return {
                        mentorId: mentor._id,
                        mentorName: `${mentor.firstName} ${mentor.lastName}`,
                        email: mentor.email,
                        role: mentor.role,
                        availability: [],
                        error: 'No active event types configured',
                    };
                }

                const availability = await this.getUserAvailability(
                    mentor._id.toString(),
                    eventTypeUuid
                );

                return {
                    mentorId: mentor._id,
                    mentorName: `${mentor.firstName} ${mentor.lastName}`,
                    email: mentor.email,
                    role: mentor.role,
                    eventTypes: mentor.calendlyConfig?.eventTypes || [],
                    availability: availability,
                };
            } catch (error) {
                this.logger.error(`Failed to fetch availability for mentor ${mentor._id}:`, error);
                return {
                    mentorId: mentor._id,
                    mentorName: `${mentor.firstName} ${mentor.lastName}`,
                    email: mentor.email,
                    role: mentor.role,
                    availability: [],
                    error: error.message,
                };
            }
        });

        return Promise.all(availabilityPromises);
    }

    /**
     * Get mentor's busy times from Calendly (scheduled events)
     */
    async getMentorBusyTimes(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
        const user = await this.userModel.findById(userId);
        if (!user || !user.calendlyConfig?.accessToken) {
            throw new BadRequestException('User has not connected Calendly account');
        }

        const accessToken = await this.getValidAccessToken(user);
        const userUri = user.calendlyConfig.calendlyUserUri;

        const params = new URLSearchParams({
            user: userUri,
            min_start_time: startDate.toISOString(),
            max_start_time: endDate.toISOString(),
            status: 'active',
        });

        const response = await fetch(
            `${this.calendlyApiBaseUrl}/scheduled_events?${params.toString()}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            this.logger.error('Failed to fetch scheduled events:', error);
            throw new BadRequestException('Failed to fetch scheduled events from Calendly');
        }

        const data = await response.json();
        return data.collection || [];
    }
}
