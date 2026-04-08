import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument } from './schemas/appointment.schema';
import { CreateAppointmentDto, AppointmentResponseDto, TranscriptSummaryResponseDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { toAppointmentResponseDto } from './utils/appointment.mapper';
import { APPOINTMENT_STATUSES, APPOINTMENT_PLATFORMS } from '../../common/constants/status.constants';
import { Availability, AvailabilityDocument } from './schemas/availability.schema';
import { AvailabilityDto } from './dto/availability.dto';
import { buildSlotDate, generateMonthlyAvailability, getWeekRange, splitIntoDurationSlots } from './utils/availability.utils';
import { HomeService } from '../home/home.service';
import { ROLES, isHostRole } from 'src/common/constants/roles.constants';
import { ZoomService } from '../zoom/zoom.service';
import { MailerService } from '../../common/utils/mail.util';
import { TranscriptSummaryService } from './transcript-summary.service';

@Injectable()
export class AppointmentsService {
    private readonly logger = new Logger(AppointmentsService.name);

    constructor(
        @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
        @InjectModel(Availability.name) private availabilityModel: Model<AvailabilityDocument>,
        private readonly notificationService: HomeService,
        private readonly zoomService: ZoomService,
        private readonly mailerService: MailerService,
        private readonly transcriptSummaryService: TranscriptSummaryService,
    ) { }

    private readonly userSelect = 'firstName lastName email phoneNumber profilePicture role roleId status';
    private readonly mentorSelect = 'firstName lastName email phoneNumber profilePicture role roleId status';

    private populateBase(query: any) {
        return query
            .populate('userId', this.userSelect)
            .populate('mentorId', this.mentorSelect);
    }

    async create(dto: CreateAppointmentDto): Promise<AppointmentResponseDto> {
        const mentorId = new Types.ObjectId(dto.mentorId);

        const isHostInitiated = dto.initiatorRole ? isHostRole(dto.initiatorRole) : false;

        const availability = await this.availabilityModel.findOne({ mentorId }).lean();
        if (!availability && !isHostInitiated) {
            throw new BadRequestException("Mentor has no availability set.");
        }

        const meetingDateUtc = new Date(dto.meetingDate);
        const meetingInMentorTz = new Date(meetingDateUtc.getTime() + (5.5 * 60 * 60 * 1000));

        const dateStr = meetingDateUtc.toISOString().split('T')[0];
        const selectedHour24 = meetingInMentorTz.getUTCHours();

        const selectedPeriod = selectedHour24 >= 12 ? "PM" : "AM";
        let displayHour = selectedHour24 % 12;
        if (displayHour === 0) displayHour = 12;

        const selectedSlot = {
            startTime: `${displayHour}:00`,
            startPeriod: selectedPeriod
        };

        if (!isHostInitiated) {
            const dayAvailability = availability!.weeklySlots.find(
                d => d.date.toISOString().split('T')[0] === dateStr
            );

            if (!dayAvailability || dayAvailability.slots.length === 0) {
                throw new BadRequestException("Mentor is not available on this date.");
            }

            const slotExists = dayAvailability.slots.some(s =>
                s.startTime === selectedSlot.startTime &&
                s.startPeriod === selectedSlot.startPeriod
            );

            if (!slotExists) {
                throw new BadRequestException("This slot is not available.");
            }
        }

        const meetingDate = meetingDateUtc;
        const durationMinutes = availability?.meetingDuration || 60;
        const endTime = new Date(meetingDate.getTime() + durationMinutes * 60 * 1000);

        const overlap = await this.appointmentModel.findOne({
            mentorId,
            meetingDate: { $lt: endTime },
            endTime: { $gt: meetingDate },
            status: APPOINTMENT_STATUSES.SCHEDULED
        });

        if (overlap) {
            throw new BadRequestException("This time slot is already booked.");
        }

        if (!isHostInitiated) {
            const noticeMs = (availability!.minSchedulingNoticeHours ?? 2) * 60 * 60 * 1000;
            const now = new Date();

            if (meetingDate.getTime() < now.getTime() + noticeMs) {
                throw new BadRequestException(
                    `Appointments must be booked at least ${availability!.minSchedulingNoticeHours} hours in advance.`
                );
            }
        }

        const startOfDay = new Date(meetingDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(meetingDate);
        endOfDay.setHours(23, 59, 59, 999);

        const dailyCount = await this.appointmentModel.countDocuments({
            mentorId,
            meetingDate: { $gte: startOfDay, $lte: endOfDay },
            status: APPOINTMENT_STATUSES.SCHEDULED,
        });

        if (dailyCount >= (availability?.maxBookingsPerDay ?? 5)) {
            throw new BadRequestException(
                "Mentor has reached maximum bookings for this day."
            );
        }

        // Get user and mentor details for Zoom meeting topic
        const userDoc = await this.appointmentModel.db.model('User').findById(dto.userId).lean() as any;
        const mentorDoc = await this.appointmentModel.db.model('User').findById(dto.mentorId).lean() as any;

        const userName = userDoc ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() : 'Student';
        const mentorName = mentorDoc ? `${mentorDoc.firstName || ''} ${mentorDoc.lastName || ''}`.trim() : 'Mentor';

        let zoomMeeting: any = null;
        let meetingLink = dto.meetingLink || null;

        if (this.zoomService.isConfigured()) {
            try {
                this.logger.log(`Creating Zoom meeting for appointment: ${userName} with ${mentorName}`);

                let mentorZoomUserId: string | undefined = mentorDoc?.zoomUserId || undefined;

                if (!mentorZoomUserId && mentorDoc?.email) {
                    const fetchedId = await this.zoomService.getUserIdByEmail(mentorDoc.email);
                    if (fetchedId) {
                        mentorZoomUserId = fetchedId;
                        this.appointmentModel.db.model('User')
                            .updateOne({ _id: mentorDoc._id }, { $set: { zoomUserId: fetchedId } })
                            .exec()
                            .catch((err: any) => this.logger.warn(`Failed to cache zoomUserId for mentor ${mentorDoc._id}: ${err?.message}`));
                    }
                }

                const zoomResponse = await this.zoomService.createMeeting({
                    topic: `Mentoring Session: ${userName} with ${mentorName}`,
                    startTime: meetingDate.toISOString(),
                    duration: durationMinutes,
                    timezone: 'Asia/Kolkata',
                    agenda: dto.notes || `Scheduled mentoring session between ${userName} and ${mentorName}`,
                    hostUserId: mentorZoomUserId,
                });

                zoomMeeting = {
                    meetingId: zoomResponse.meetingId,
                    joinUrl: zoomResponse.joinUrl,
                    startUrl: zoomResponse.startUrl,
                    password: zoomResponse.password,
                    hostEmail: zoomResponse.hostEmail,
                    hostId: zoomResponse.hostId,
                    topic: zoomResponse.topic,
                    duration: zoomResponse.duration,
                    timezone: zoomResponse.timezone,
                    createdAt: zoomResponse.createdAt,
                };
                meetingLink = zoomResponse.joinUrl;

                this.logger.log(`Zoom meeting created successfully: ${zoomResponse.meetingId}`);

            } catch (error) {
                this.logger.error(`Failed to create Zoom meeting: ${error.message}`);
                // Continue without Zoom meeting - don't fail the appointment creation
            }
        } else {
            this.logger.warn('Zoom is not configured. Creating appointment without Zoom meeting.');
        }

        const { initiatorRole: _initiatorRole, ...appointmentFields } = dto;

        const appointment = new this.appointmentModel({
            ...appointmentFields,
            meetingDate,
            endTime,
            userId: new Types.ObjectId(dto.userId),
            mentorId,
            platform: APPOINTMENT_PLATFORMS.ZOOM,
            meetingLink,
            zoomMeetingId: zoomMeeting?.meetingId || null,
            zoomMeeting,
        });

        const saved = await appointment.save();

        const populated = await this.populateBase(
            this.appointmentModel.findById(saved._id)
        ).lean();

        await this.availabilityModel.updateOne(
            {
                mentorId,
                "weeklySlots.date": new Date(dateStr)
            },
            {
                $pull: {
                    "weeklySlots.$.slots": {
                        startTime: selectedSlot.startTime,
                        startPeriod: selectedSlot.startPeriod
                    }
                }
            }
        );

        const result = toAppointmentResponseDto(populated as AppointmentDocument);

        try {
            const meetingIso = result.meetingDate.toISOString();
            const zoomInfo = meetingLink ? ` Zoom link: ${meetingLink}` : '';

            await this.notificationService.addNotification({
                userId: dto.userId,
                name: 'APPOINTMENT_SCHEDULED',
                details: `Your appointment with ${mentorName} is scheduled at ${meetingIso}.${zoomInfo}`,
                module: 'APPOINTMENT'
            });

            await this.notificationService.addNotification({
                userId: dto.mentorId,
                name: 'NEW_APPOINTMENT',
                details: `${userName} has booked an appointment with you at ${meetingIso}.${zoomInfo}`,
                module: 'APPOINTMENT'
            });

            await this.notificationService.addNotification({
                role: ROLES.DIRECTOR,
                name: 'APPOINTMENT_BOOKED',
                details: `${userName} booked an appointment with ${mentorName} at ${meetingIso}.`,
                module: 'APPOINTMENT'
            });

            // Send email notifications to pastor (user) and mentor if Zoom link exists
            if (meetingLink && zoomMeeting) {
                const emailOpts = {
                    joinUrl: meetingLink,
                    password: zoomMeeting.password,
                    meetingId: zoomMeeting.meetingId,
                    durationMinutes,
                    meetingDate: result.meetingDate,
                };

                if (userDoc?.email) {
                    await this.mailerService.sendAppointmentConfirmation({
                        to: userDoc.email,
                        recipientName: userName,
                        otherPartyName: mentorName,
                        role: 'pastor',
                        ...emailOpts,
                    });
                }

                if (mentorDoc?.email) {
                    await this.mailerService.sendAppointmentConfirmation({
                        to: mentorDoc.email,
                        recipientName: mentorName,
                        otherPartyName: userName,
                        role: 'mentor',
                        ...emailOpts,
                    });
                }
            }

        } catch (err) {
            this.logger.warn(`Failed to send appointment notifications: ${err?.message ?? err}`);
        }

        return result;
    }

    async getAppointments(options?: {
        userId?: string;
        mentorId?: string;
        futureOnly?: boolean;
        status?: string;
    }): Promise<AppointmentResponseDto[]> {
        const { userId, mentorId, futureOnly = true, status } = options || {};
        const query: any = {};

        if (userId && mentorId) {
            const userObjId = new Types.ObjectId(userId);
            const mentorObjId = new Types.ObjectId(mentorId);
            query.$or = [
                { userId: userObjId },
                { mentorId: mentorObjId }
            ];
        } else if (userId) {
            query.userId = new Types.ObjectId(userId);
        } else if (mentorId) {
            query.mentorId = new Types.ObjectId(mentorId);
        }

        if (futureOnly) {
            query.meetingDate = { $gte: new Date() };
        }

        if (status) {
            query.status = status;
        }

        const appointments = await this.populateBase(
            this.appointmentModel.find(query).sort({ meetingDate: 1 })
        ).lean().exec();

        return appointments.map(toAppointmentResponseDto);
    }

    async getSchedule(
        id: string,
        role: 'user' | 'mentor',
        futureOnly: boolean = true
    ): Promise<AppointmentResponseDto[]> {
        // Map role to userId or mentorId parameter
        if (role === 'user') {
            return this.getAppointments({ userId: id, futureOnly });
        } else {
            return this.getAppointments({ mentorId: id, futureOnly });
        }
    }

    async getAllUpcoming(userId?: string): Promise<AppointmentResponseDto[]> {
        if (userId) {
            // Check both userId and mentorId fields (user as mentee OR mentor)
            return this.getAppointments({
                userId,
                mentorId: userId,
                futureOnly: true,
                status: APPOINTMENT_STATUSES.SCHEDULED
            });
        }
        return this.getAppointments({
            futureOnly: true,
            status: APPOINTMENT_STATUSES.SCHEDULED
        });
    }

    async getTranscriptSummary(appointmentId: string): Promise<TranscriptSummaryResponseDto> {
        const appointment = await this.appointmentModel.findById(appointmentId).lean() as any;
        if (!appointment) {
            throw new NotFoundException(`Appointment with ID "${appointmentId}" not found.`);
        }

        if (!appointment.transcriptSummary || !appointment.transcriptSummarySavedAt) {
            throw new NotFoundException('Transcript summary is not generated yet for this appointment.');
        }

        return {
            appointmentId: appointment._id.toString(),
            transcript: appointment.transcript ?? undefined,
            transcriptSavedAt: appointment.transcriptSavedAt ?? undefined,
            summary: appointment.transcriptSummary,
            generatedAt: appointment.transcriptSummarySavedAt,
            model: appointment.transcriptSummaryModel ?? this.transcriptSummaryService.modelName,
            cached: true,
        };
    }

    async generateTranscriptSummary(appointmentId: string, refresh = false): Promise<TranscriptSummaryResponseDto> {
        const appointment = await this.appointmentModel.findById(appointmentId).lean() as any;
        if (!appointment) {
            throw new NotFoundException(`Appointment with ID "${appointmentId}" not found.`);
        }

        const transcript = typeof appointment.transcript === 'string' ? appointment.transcript.trim() : '';
        if (!transcript || transcript.length < 40) {
            throw new BadRequestException('Transcript is missing or too short to summarize.');
        }

        const transcriptSavedAt = appointment.transcriptSavedAt ? new Date(appointment.transcriptSavedAt) : null;
        const summarySavedAt = appointment.transcriptSummarySavedAt ? new Date(appointment.transcriptSummarySavedAt) : null;
        const hasCachedSummary = !!appointment.transcriptSummary && !!summarySavedAt;
        const isCacheFresh = hasCachedSummary && !!transcriptSavedAt && summarySavedAt!.getTime() >= transcriptSavedAt.getTime();

        if (!refresh && hasCachedSummary && isCacheFresh) {
            return {
                appointmentId: appointment._id.toString(),
                transcript: appointment.transcript ?? undefined,
                transcriptSavedAt: appointment.transcriptSavedAt ?? undefined,
                summary: appointment.transcriptSummary,
                generatedAt: summarySavedAt!,
                model: appointment.transcriptSummaryModel ?? this.transcriptSummaryService.modelName,
                cached: true,
            };
        }

        const summary = await this.transcriptSummaryService.summarizeTranscript(transcript);
        const generatedAt = new Date();
        const model = this.transcriptSummaryService.modelName;

        await this.appointmentModel.updateOne(
            { _id: appointment._id },
            {
                $set: {
                    transcriptSummary: summary,
                    transcriptSummarySavedAt: generatedAt,
                    transcriptSummaryModel: model,
                },
            }
        );

        return {
            appointmentId: appointment._id.toString(),
            transcript,
            transcriptSavedAt: transcriptSavedAt ?? undefined,
            summary,
            generatedAt,
            model,
            cached: false,
        };
    }

    async update(id: string, dto: UpdateAppointmentDto): Promise<AppointmentResponseDto> {
        const { initiatorRole: _ir, ...updatePayload }: any = dto;

        if (dto.meetingDate) {
            const newMeetingDate = new Date(dto.meetingDate);
            updatePayload.meetingDate = newMeetingDate;
            updatePayload.endTime = new Date(newMeetingDate.getTime() + 60 * 60 * 1000);
        }

        const populated = await this.populateBase(
            this.appointmentModel.findByIdAndUpdate(
                new Types.ObjectId(id),
                { $set: updatePayload },
                { new: true }
            )
        ).lean().exec();

        if (!populated) {
            throw new NotFoundException(`Appointment with ID "${id}" not found.`);
        }

        try {

            let userName = 'User';
            let mentorName = 'Mentor';

            const userDoc: any = populated.userId;
            const mentorDoc: any = populated.mentorId;

            if (userDoc) userName = `${userDoc.firstName ?? ''} ${userDoc.lastName ?? ''}`.trim();
            if (mentorDoc) mentorName = `${mentorDoc.firstName ?? ''} ${mentorDoc.lastName ?? ''}`.trim();

            const newIso = populated.meetingDate.toISOString();

            await this.notificationService.addNotification({
                userId: populated.userId._id.toString(),
                name: 'APPOINTMENT_RESCHEDULED',
                details: `Your appointment with ${mentorName} has been rescheduled to ${newIso}.`,
                module: 'APPOINTMENT',
            });

            await this.notificationService.addNotification({
                userId: populated.mentorId._id.toString(),
                name: 'APPOINTMENT_RESCHEDULED',
                details: `${userName} rescheduled their appointment to ${newIso}.`,
                module: 'APPOINTMENT',
            });

            await this.notificationService.addNotification({
                role: ROLES.DIRECTOR,
                name: 'APPOINTMENT_RESCHEDULED',
                details: `${userName} rescheduled an appointment with ${mentorName} to ${newIso}.`,
                module: 'APPOINTMENT',
            });

            // Send rescheduled emails to pastor and mentor if Zoom link present
            const joinUrl = (populated as any).meetingLink;
            const zoom = (populated as any).zoomMeeting;
            if (joinUrl) {
                const emailOpts = {
                    joinUrl,
                    password: zoom?.password,
                    meetingId: zoom?.meetingId,
                    durationMinutes: 60,
                    newMeetingDate: populated.meetingDate,
                };
                if (userDoc?.email) {
                    await this.mailerService.sendAppointmentRescheduled({
                        to: userDoc.email,
                        recipientName: userName,
                        otherPartyName: mentorName,
                        ...emailOpts,
                    });
                }
                if (mentorDoc?.email) {
                    await this.mailerService.sendAppointmentRescheduled({
                        to: mentorDoc.email,
                        recipientName: mentorName,
                        otherPartyName: userName,
                        ...emailOpts,
                    });
                }
            }

        } catch (err) {
            this.logger.warn(`Failed to send reschedule notifications: ${err?.message ?? err}`);
        }

        return toAppointmentResponseDto(populated as AppointmentDocument);
    }

    async upsertAvailability(dto: AvailabilityDto) {

        const mentorId = new Types.ObjectId(dto.mentorId);
        const meetingDuration = dto.meetingDuration ?? 60;

        let availability = await this.availabilityModel.findOne({ mentorId });

        if (!availability) {
            availability = new this.availabilityModel({
                mentorId,
                weeklySlots: []
            });
        }

        for (const day of dto.weeklySlots) {

            const raw = day.slots;

            const expanded = raw.flatMap(slot =>
                splitIntoDurationSlots(
                    slot.startTime,
                    slot.startPeriod,
                    slot.endTime,
                    slot.endPeriod,
                    meetingDuration
                )
            );

            const dateStr = new Date(day.date).toISOString().split("T")[0];

            const index = availability.weeklySlots.findIndex(
                d => d.date.toISOString().split("T")[0] === dateStr
            );

            const entry = {
                date: new Date(day.date),
                rawSlots: raw,
                slots: expanded
            };

            if (index !== -1) {
                availability.weeklySlots[index] = entry;
            } else {
                availability.weeklySlots.push(entry);
            }
        }

        availability.meetingDuration = meetingDuration;
        availability.minSchedulingNoticeHours = dto.minSchedulingNoticeHours ?? 2;
        availability.maxBookingsPerDay = dto.maxBookingsPerDay ?? 5;

        await availability.save();

        return availability;
    }

    async getMentorAvailability(mentorId: string) {
        const objectId = new Types.ObjectId(mentorId);

        const data = await this.availabilityModel
            .findOne({ mentorId: objectId })
            .lean();

        if (!data) {
            return {
                mentorId,
                weeklySlots: []
            };
        }

        return {
            mentorId: data.mentorId,
            weeklySlots: data.weeklySlots.map(d => ({
                date: d.date,
                rawSlots: d.rawSlots
            }))
        };
    }

    async getMonthlyAvailability(mentorId: string, year: number, month: number) {
        const objectId = new Types.ObjectId(mentorId);
        const data = await this.availabilityModel.findOne({ mentorId: objectId }).lean();

        if (!data) {
            return [];
        }

        const monthly = generateMonthlyAvailability(data.weeklySlots, year, month);

        const now = new Date();
        const noticeMs = (data.minSchedulingNoticeHours ?? 2) * 60 * 60 * 1000;

        return Promise.all(
            monthly.map(async (day) => {
                const dayDate = new Date(day.date);

                const startOfDay = new Date(dayDate);
                startOfDay.setHours(0, 0, 0, 0);

                const endOfDay = new Date(dayDate);
                endOfDay.setHours(23, 59, 59, 999);

                const bookingCount = await this.appointmentModel.countDocuments({
                    mentorId: objectId,
                    meetingDate: { $gte: startOfDay, $lte: endOfDay },
                    status: APPOINTMENT_STATUSES.SCHEDULED,
                });

                if (bookingCount >= (data.maxBookingsPerDay ?? 5)) {
                    return { ...day, slots: [] };
                }

                const filteredSlots = day.slots.filter(slot => {
                    const slotDate = buildSlotDate(day.date, slot);
                    return slotDate.getTime() >= now.getTime() + noticeMs;
                });

                return { ...day, slots: filteredSlots };
            })
        );
    }

    async reschedule(appointmentId: string, dto: { newDate: string }) {
        const IST_OFFSET = 5.5 * 3600 * 1000;

        const appointment = await this.appointmentModel.findById(appointmentId).lean();
        if (!appointment) throw new BadRequestException("Appointment not found.");

        const mentorId = appointment.mentorId;
        const availability = await this.availabilityModel.findOne({ mentorId }).lean();
        if (!availability) throw new BadRequestException("Mentor has no availability set.");

        const durationMinutes = availability.meetingDuration;
        if (!durationMinutes || typeof durationMinutes !== "number") {
            throw new BadRequestException("Invalid meeting duration.");
        }

        // Parse new meeting date
        const meetingDateUtc = new Date(dto.newDate);
        const meetingInMentorTz = new Date(meetingDateUtc.getTime() + IST_OFFSET);

        const weekday = meetingInMentorTz.getUTCDay();
        const selectedHour24 = meetingInMentorTz.getUTCHours();
        const minute = meetingInMentorTz.getUTCMinutes();

        if (minute !== 0)
            throw new BadRequestException("Time must start exactly at the hour.");

        // Compute start slot for new time
        const selectedPeriod = selectedHour24 >= 12 ? "PM" : "AM";
        let displayHour = selectedHour24 % 12;
        if (displayHour === 0) displayHour = 12;

        // Compute NEW end time
        const newEndUtc = new Date(meetingDateUtc.getTime() + durationMinutes * 60000);
        const newEndLocal = new Date(newEndUtc.getTime() + IST_OFFSET);

        const endHour24 = newEndLocal.getUTCHours();
        const endPeriod = endHour24 >= 12 ? "PM" : "AM";

        let endDisplayHour = endHour24 % 12;
        if (endDisplayHour === 0) endDisplayHour = 12;

        const selectedSlot = {
            startTime: `${displayHour}:00`,
            startPeriod: selectedPeriod,
            endTime: `${endDisplayHour}:00`,
            endPeriod: endPeriod
        };

        // Check availability
        const dateStr = meetingDateUtc.toISOString().split("T")[0];

        const dayAvailability = availability.weeklySlots.find(
            d => d.date.toISOString().split("T")[0] === dateStr
        );

        if (!dayAvailability || dayAvailability.slots.length === 0)
            throw new BadRequestException("Mentor is not available on this date.");

        const slotExists = dayAvailability.slots.some(s =>
            s.startTime === selectedSlot.startTime &&
            s.startPeriod === selectedSlot.startPeriod &&
            s.endTime === selectedSlot.endTime &&
            s.endPeriod === selectedSlot.endPeriod
        );

        if (!slotExists)
            throw new BadRequestException("Selected slot is not available.");

        // Overlap check
        const overlap = await this.appointmentModel.findOne({
            mentorId,
            _id: { $ne: appointmentId },
            meetingDate: { $lt: newEndUtc },
            endTime: { $gt: meetingDateUtc },
            status: "scheduled"
        });

        if (overlap)
            throw new BadRequestException("This slot is already booked by another appointment.");

        // 🚨 enforce max bookings per day for new date
        const startOfDay = new Date(meetingDateUtc);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(meetingDateUtc);
        endOfDay.setHours(23, 59, 59, 999);

        const dailyCount = await this.appointmentModel.countDocuments({
            mentorId,
            meetingDate: { $gte: startOfDay, $lte: endOfDay },
            status: APPOINTMENT_STATUSES.SCHEDULED,
            _id: { $ne: appointmentId }
        });

        if (dailyCount >= (availability.maxBookingsPerDay ?? 5)) {
            throw new BadRequestException(
                "Mentor has reached maximum bookings for this day."
            );
        }

        // Restore old slot 
        const oldMeetingUtc = new Date(appointment.meetingDate);
        const oldLocal = new Date(oldMeetingUtc.getTime() + IST_OFFSET);

        // const oldWeekday = oldLocal.getUTCDay();
        const oldHour24 = oldLocal.getUTCHours();
        const oldPeriod = oldHour24 >= 12 ? "PM" : "AM";

        let oldDisplay = oldHour24 % 12;
        if (oldDisplay === 0) oldDisplay = 12;

        // Old end calculation
        const oldEndUtc = new Date(oldMeetingUtc.getTime() + durationMinutes * 60000);
        const oldEndLocal = new Date(oldEndUtc.getTime() + IST_OFFSET);

        const oldEndHour24 = oldEndLocal.getUTCHours();
        const oldEndPeriod = oldEndHour24 >= 12 ? "PM" : "AM";

        let oldEndDisplay = oldEndHour24 % 12;
        if (oldEndDisplay === 0) oldEndDisplay = 12;

        const oldSlot = {
            startTime: `${oldDisplay}:00`,
            startPeriod: oldPeriod,
            endTime: `${oldEndDisplay}:00`,
            endPeriod: oldEndPeriod
        };

        // Restore old slot back into availability
        const oldDateStr = oldMeetingUtc.toISOString().split("T")[0];

        await this.availabilityModel.updateOne(
            { mentorId, "weeklySlots.date": new Date(oldDateStr) },
            { $addToSet: { "weeklySlots.$.slots": oldSlot } }
        );

        await this.availabilityModel.updateOne(
            { mentorId, "weeklySlots.date": new Date(dateStr) },
            { $pull: { "weeklySlots.$.slots": selectedSlot } }
        );

        const updated = await this.populateBase(
            this.appointmentModel.findByIdAndUpdate(
                appointmentId,
                {
                    $set: {
                        meetingDate: meetingDateUtc,
                        endTime: newEndUtc,
                        status: APPOINTMENT_STATUSES.SCHEDULED
                    }
                },
                { new: true }
            )
        ).lean();

        return toAppointmentResponseDto(updated as AppointmentDocument);
    }

    async handleZoomWebhook(payload: any): Promise<void> {
        const event = payload?.event;
        this.logger.log(`Zoom webhook received: ${event}`);

        if (event === 'recording.transcript_completed') {
            const meetingId = payload?.payload?.object?.id?.toString();

            if (!meetingId) {
                this.logger.warn('Zoom webhook: missing meetingId');
                return;
            }

            const appointment = await this.appointmentModel
                .findOne({ zoomMeetingId: meetingId })
                .lean();

            if (!appointment) {
                this.logger.warn(`Zoom webhook: no appointment found for meetingId ${meetingId}`);
                return;
            }

            try {
                const transcriptText = await this.zoomService.downloadTranscript(meetingId);

                await this.appointmentModel.updateOne(
                    { _id: appointment._id },
                    {
                        $set: {
                            transcript: transcriptText,
                            transcriptSavedAt: new Date(),
                            transcriptSummary: null,
                            transcriptSummarySavedAt: null,
                            transcriptSummaryModel: null,
                        },
                    }
                );

                this.logger.log(
                    `Transcript saved for appointment ${appointment._id} (meetingId: ${meetingId})`
                );
            } catch (err) {
                this.logger.error(
                    `Failed to save transcript for meetingId ${meetingId}: ${err.message}`
                );
            }
        }
    }

    async cancel(appointmentId: string, dto: { reason?: string }) {
        const IST_OFFSET = 5.5 * 3600 * 1000;

        // load appointment
        const appointment = await this.appointmentModel.findById(appointmentId).lean() as any;
        if (!appointment) throw new NotFoundException("Appointment not found.");

        // only scheduled appointments can be cancelled
        if (appointment.status !== APPOINTMENT_STATUSES.SCHEDULED) {
            throw new BadRequestException("Only scheduled appointments can be cancelled.");
        }

        // Delete Zoom meeting if exists
        if (appointment.zoomMeetingId && this.zoomService.isConfigured()) {
            try {
                this.logger.log(`Deleting Zoom meeting: ${appointment.zoomMeetingId}`);
                await this.zoomService.deleteMeeting(appointment.zoomMeetingId);
                this.logger.log(`Zoom meeting ${appointment.zoomMeetingId} deleted successfully`);
            } catch (error) {
                this.logger.warn(`Failed to delete Zoom meeting ${appointment.zoomMeetingId}: ${error.message}`);
                // Continue with cancellation even if Zoom deletion fails
            }
        }

        const mentorId = appointment.mentorId;

        // load availability
        const availability = await this.availabilityModel.findOne({ mentorId }).lean();
        if (!availability) {
            // still cancel the appointment but warn — here we choose to still cancel and skip restoring slot
            await this.appointmentModel.updateOne(
                { _id: appointment._id },
                {
                    $set: {
                        status: APPOINTMENT_STATUSES.CANCELED ?? 'canceled',
                        canceledAt: new Date(),
                        cancelReason: dto.reason ?? null
                    }
                }
            );
            return { appointmentId, status: APPOINTMENT_STATUSES.CANCELED ?? 'canceled' };
        }

        const durationMinutes = availability.meetingDuration ?? 60;

        // compute old slot (start + end) using mentor tz (IST)
        const oldMeetingUtc = new Date(appointment.meetingDate);
        const oldLocal = new Date(oldMeetingUtc.getTime() + IST_OFFSET);

        const oldWeekday = oldLocal.getUTCDay();
        const oldHour24 = oldLocal.getUTCHours();
        const oldPeriod = oldHour24 >= 12 ? "PM" : "AM";
        let oldDisplay = oldHour24 % 12;
        if (oldDisplay === 0) oldDisplay = 12;

        const oldEndUtc = new Date(oldMeetingUtc.getTime() + durationMinutes * 60000);
        const oldEndLocal = new Date(oldEndUtc.getTime() + IST_OFFSET);

        const oldEndHour24 = oldEndLocal.getUTCHours();
        const oldEndPeriod = oldEndHour24 >= 12 ? "PM" : "AM";
        let oldEndDisplay = oldEndHour24 % 12;
        if (oldEndDisplay === 0) oldEndDisplay = 12;

        const oldSlot = {
            startTime: `${oldDisplay}:00`,
            startPeriod: oldPeriod,
            endTime: `${oldEndDisplay}:00`,
            endPeriod: oldEndPeriod
        };

        // push slot back into availability
        await this.availabilityModel.updateOne(
            { mentorId, "weeklySlots.day": oldWeekday },
            { $addToSet: { "weeklySlots.$.slots": oldSlot } }
        );

        // update appointment to cancelled
        const cancelledStatus = APPOINTMENT_STATUSES.CANCELED;

        const updated = await this.populateBase(
            this.appointmentModel.findByIdAndUpdate(
                appointment._id,
                {
                    $set: {
                        status: cancelledStatus,
                        canceledAt: new Date(),
                        cancelReason: dto.reason ?? null
                    }
                },
                { new: true }
            )
        ).lean();


        try {
            const populated = updated; // already populated via populateBase()

            let userName = 'User';
            let mentorName = 'Mentor';

            const userDoc: any = populated.userId;
            const mentorDoc: any = populated.mentorId;

            if (userDoc) {
                userName = `${userDoc.firstName ?? ''} ${userDoc.lastName ?? ''}`.trim();
            }

            if (mentorDoc) {
                mentorName = `${mentorDoc.firstName ?? ''} ${mentorDoc.lastName ?? ''}`.trim();
            }

            const dateIso = populated.meetingDate.toISOString();
            const reasonText = dto.reason ? `Reason: ${dto.reason}` : 'No reason provided';

            await this.notificationService.addNotification({
                userId: populated.userId._id.toString(),
                name: 'APPOINTMENT_CANCELED',
                details: `Your appointment with ${mentorName} on ${dateIso} was canceled. ${reasonText}`,
                module: 'APPOINTMENT',
            });

            await this.notificationService.addNotification({
                userId: populated.mentorId._id.toString(),
                name: 'APPOINTMENT_CANCELED',
                details: `${userName} canceled their appointment scheduled at ${dateIso}. ${reasonText}`,
                module: 'APPOINTMENT',
            });

            await this.notificationService.addNotification({
                role: ROLES.DIRECTOR,
                name: 'APPOINTMENT_CANCELED',
                details: `${userName}'s appointment with ${mentorName} on ${dateIso} was canceled. ${reasonText}`,
                module: 'APPOINTMENT',
            });

            // Send cancellation emails to pastor and mentor
            const cancelEmailOpts = {
                meetingDate: populated.meetingDate,
                reason: dto.reason,
            };
            if (userDoc?.email) {
                await this.mailerService.sendAppointmentCancellation({
                    to: userDoc.email,
                    recipientName: userName,
                    otherPartyName: mentorName,
                    ...cancelEmailOpts,
                });
            }
            if (mentorDoc?.email) {
                await this.mailerService.sendAppointmentCancellation({
                    to: mentorDoc.email,
                    recipientName: mentorName,
                    otherPartyName: userName,
                    ...cancelEmailOpts,
                });
            }

        } catch (err) {
            this.logger.warn(`Failed to send cancellation notifications: ${err?.message ?? err}`);
        }


        return toAppointmentResponseDto(updated as AppointmentDocument);
    }

    async getWeeklyAvailabilityByDate(
        mentorId: string,
        dateStr: string
    ) {
        const objectId = new Types.ObjectId(mentorId);

        const availability = await this.availabilityModel
            .findOne({ mentorId: objectId })
            .lean();

        if (!availability) return [];

        const weekDays = getWeekRange(dateStr);

        const now = new Date();
        const noticeMs =
            (availability.minSchedulingNoticeHours ?? 2) * 60 * 60 * 1000;

        return Promise.all(
            weekDays.map(async (d) => {

                const currentDateStr = d.toISOString().slice(0, 10);

                const template = availability.weeklySlots.find(
                    w => new Date(w.date).toISOString().slice(0, 10) === currentDateStr
                );

                let slots = template?.slots ?? [];

                const startOfDay = new Date(d);
                startOfDay.setUTCHours(0, 0, 0, 0);

                const endOfDay = new Date(d);
                endOfDay.setUTCHours(23, 59, 59, 999);

                const bookingCount = await this.appointmentModel.countDocuments({
                    mentorId: objectId,
                    meetingDate: { $gte: startOfDay, $lte: endOfDay },
                    status: APPOINTMENT_STATUSES.SCHEDULED,
                });

                if (bookingCount >= (availability.maxBookingsPerDay ?? 5)) {
                    slots = [];
                } else {
                    slots = slots.filter(slot => {
                        const slotDate = buildSlotDate(currentDateStr, slot);
                        return slotDate.getTime() >= now.getTime() + noticeMs;
                    });
                }

                return {
                    date: currentDateStr,
                    day: d.getUTCDay(),
                    slots
                };
            })
        );
    }
}