import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument } from '../appointments/schemas/appointment.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CalendlyEventLog, CalendlyEventDocument } from './schemas/calendly-event.schema';
import { CalendlyWebhookPayload } from './dto/calendly-webhook.dto';
import { MailerService } from '../../common/utils/mail.util';
import { HomeService } from '../home/home.service';
import { APPOINTMENT_STATUSES, APPOINTMENT_PLATFORMS } from '../../common/constants/status.constants';
import { ROLES } from '../../common/constants/roles.constants';
import * as crypto from 'crypto';

@Injectable()
export class CalendlyService {
    private readonly logger = new Logger(CalendlyService.name);

    constructor(
        @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(CalendlyEventLog.name) private calendlyEventModel: Model<CalendlyEventDocument>,
        private readonly mailerService: MailerService,
        private readonly notificationService: HomeService,
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

        // Create appointment in database
        const appointment = await this.appointmentModel.create({
            userId: student._id,
            mentorId: mentor._id,
            meetingDate: new Date(event.start_time),
            endTime: new Date(event.end_time),
            platform: APPOINTMENT_PLATFORMS.CALENDLY,
            meetingLink: event.location?.join_url || event.uri,
            status: APPOINTMENT_STATUSES.SCHEDULED,
            source: 'calendly',
            calendlyEventUri: event.uri,
            calendlyInviteeUri: invitee.uri,
            calendlyMetadata: {
                eventTypeUri: event.event_type,
                eventTypeName: event.name,
                inviteeName: invitee.name,
                inviteeEmail: invitee.email,
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
}
