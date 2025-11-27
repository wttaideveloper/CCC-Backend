import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument } from './schemas/appointment.schema';
import { CreateAppointmentDto, AppointmentResponseDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { toAppointmentResponseDto } from './utils/appointment.mapper';
import { APPOINTMENT_STATUSES } from '../../common/constants/status.constants';
import { Availability, AvailabilityDocument } from './schemas/availability.schema';
import { AvailabilityDto } from './dto/availability.dto';
import { generateMonthlyAvailability, splitIntoDurationSlots } from './utils/availability.utils';
import { HomeService } from '../home/home.service';
import { ROLES } from 'src/common/constants/roles.constants';

@Injectable()
export class AppointmentsService {
    constructor(
        @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
        @InjectModel(Availability.name) private availabilityModel: Model<AvailabilityDocument>,
        private readonly notificationService: HomeService,
    ) { }

    private readonly userSelect = 'firstName lastName email phoneNumber profilePicture';
    private readonly mentorSelect = 'firstName lastName email phoneNumber profilePicture';

    private populateBase(query: any) {
        return query
            .populate('userId', this.userSelect)
            .populate('mentorId', this.mentorSelect);
    }

    async create(dto: CreateAppointmentDto): Promise<AppointmentResponseDto> {
        const mentorId = new Types.ObjectId(dto.mentorId);

        const availability = await this.availabilityModel.findOne({ mentorId }).lean();
        if (!availability) {
            throw new BadRequestException("Mentor has no availability set.");
        }

        const meetingDateUtc = new Date(dto.meetingDate);
        const meetingInMentorTz = new Date(meetingDateUtc.getTime() + (5.5 * 60 * 60 * 1000));

        const weekday = meetingInMentorTz.getUTCDay();
        const selectedHour24 = meetingInMentorTz.getUTCHours();
        const selectedMinute = meetingInMentorTz.getUTCMinutes();

        const selectedPeriod = selectedHour24 >= 12 ? "PM" : "AM";
        let displayHour = selectedHour24 % 12;
        if (displayHour === 0) displayHour = 12;

        const selectedSlot = {
            startTime: displayHour.toString(),
            startPeriod: selectedPeriod
        };

        const dayAvailability = availability.weeklySlots.find(d => d.day === weekday);

        if (!dayAvailability || dayAvailability.slots.length === 0) {
            throw new BadRequestException("Mentor is not available on this day.");
        }

        const slotExists = dayAvailability.slots.some(s =>
            s.startTime === selectedSlot.startTime &&
            s.startPeriod === selectedSlot.startPeriod
        );

        if (!slotExists) {
            throw new BadRequestException("This slot is not available.");
        }

        const meetingDate = meetingDateUtc;
        const endTime = new Date(meetingDate.getTime() + 60 * 60 * 1000);

        const overlap = await this.appointmentModel.findOne({
            mentorId,
            meetingDate: { $lt: endTime },
            endTime: { $gt: meetingDate },
            status: APPOINTMENT_STATUSES.SCHEDULED
        });

        if (overlap) {
            throw new BadRequestException("This time slot is already booked.");
        }

        const appointment = new this.appointmentModel({
            ...dto,
            meetingDate,
            endTime,
            userId: new Types.ObjectId(dto.userId),
            mentorId
        });

        const saved = await appointment.save();

        const populated = await this.populateBase(
            this.appointmentModel.findById(saved._id)
        ).lean();

        await this.availabilityModel.updateOne(
            {
                mentorId,
                "weeklySlots.day": weekday
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
            let userName = 'User';
            let mentorName = 'Mentor';

            const userDoc: any = (populated as any).userId;
            const mentorDoc: any = (populated as any).mentorId;

            if (userDoc) {
                userName = `${userDoc.firstName ?? ''} ${userDoc.lastName ?? ''}`.trim();
            }

            if (mentorDoc) {
                mentorName = `${mentorDoc.firstName ?? ''} ${mentorDoc.lastName ?? ''}`.trim();
            }

            const meetingIso = result.meetingDate.toISOString();

            await this.notificationService.addNotification({
                userId: dto.userId,
                name: 'APPOINTMENT_SCHEDULED',
                details: `Your appointment with ${mentorName} is scheduled at ${meetingIso}.`,
                module: 'APPOINTMENT'
            });

            await this.notificationService.addNotification({
                userId: dto.mentorId,
                name: 'NEW_APPOINTMENT',
                details: `${userName} has booked an appointment with you at ${meetingIso}.`,
                module: 'APPOINTMENT'
            });

            await this.notificationService.addNotification({
                role: ROLES.DIRECTOR,
                name: 'APPOINTMENT_BOOKED',
                details: `${userName} booked an appointment with ${mentorName} at ${meetingIso}.`,
                module: 'APPOINTMENT'
            });

        } catch (err) {
            console.warn('Failed to send appointment notifications:', err?.message ?? err);
        }

        return result

    }

    async getSchedule(
        id: string,
        role: 'user' | 'mentor',
        futureOnly: boolean = true
    ): Promise<AppointmentResponseDto[]> {
        const objectId = new Types.ObjectId(id);
        const query: any = {};

        query[role === 'user' ? 'userId' : 'mentorId'] = objectId;

        if (futureOnly) {
            query.meetingDate = { $gte: new Date() };
        }

        const appointments = await this.populateBase(
            this.appointmentModel.find(query).sort({ meetingDate: 1 })
        ).lean().exec();

        return appointments.map(toAppointmentResponseDto);
    }

    async getAllUpcoming(): Promise<AppointmentResponseDto[]> {
        const now = new Date();

        const upcoming = await this.appointmentModel
            .find({
                meetingDate: { $gte: now },
                status: APPOINTMENT_STATUSES.SCHEDULED,
            })
            .sort({ meetingDate: 1 })
            .lean();

        const populated = await this.populateBase(
            this.appointmentModel.find({
                meetingDate: { $gte: now },
                status: APPOINTMENT_STATUSES.SCHEDULED,
            }).sort({ meetingDate: 1 })
        ).lean();

        return populated.map((a: any) =>
            toAppointmentResponseDto(a)
        );
    }

    async update(id: string, dto: UpdateAppointmentDto): Promise<AppointmentResponseDto> {
        const updatePayload: any = { ...dto };

        if (dto.meetingDate) {
            const newMeetingDate = new Date(dto.meetingDate);
            updatePayload.meetingDate = newMeetingDate;
            updatePayload.endTime = new Date(newMeetingDate.getTime() + 60 * 60 * 1000);
        }

        const updatedAppointment = await this.appointmentModel.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: updatePayload },
            { new: true }
        ).exec();

        if (!updatedAppointment) {
            throw new NotFoundException(`Appointment with ID "${id}" not found.`);
        }

        try {
            const populated = await this.populateBase(
                this.appointmentModel.findById(updatedAppointment._id)
            ).lean();

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

        } catch (err) {
            console.warn('Failed to send reschedule notifications:', err?.message ?? err);
        }

        return toAppointmentResponseDto(updatedAppointment as AppointmentDocument);
    }

    async upsertAvailability(dto: AvailabilityDto) {
        const meetingDuration = dto.meetingDuration ?? 60;

        const processedSlots = dto.weeklySlots.map(day => {
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

            return {
                day: day.day,
                date: new Date(day.date),
                rawSlots: raw,
                slots: expanded
            };
        });

        return this.availabilityModel.findOneAndUpdate(
            { mentorId: new Types.ObjectId(dto.mentorId) },
            {
                $set: {
                    mentorId: new Types.ObjectId(dto.mentorId),
                    weeklySlots: processedSlots,
                    meetingDuration,
                    minSchedulingNoticeHours: dto.minSchedulingNoticeHours ?? 2,
                    maxBookingsPerDay: dto.maxBookingsPerDay ?? 5
                }
            },
            { new: true, upsert: true }
        );
    }

    async getMentorAvailability(mentorId: string) {
        const objectId = new Types.ObjectId(mentorId);
        const data = await this.availabilityModel.findOne({ mentorId: objectId }).lean();
        if (!data) {
            return {
                mentorId,
                weeklySlots: [
                    { day: 0, rawSlots: [] },
                    { day: 1, rawSlots: [] },
                    { day: 2, rawSlots: [] },
                    { day: 3, rawSlots: [] },
                    { day: 4, rawSlots: [] },
                    { day: 5, rawSlots: [] },
                    { day: 6, rawSlots: [] }
                ]
            };
        }

        return {
            mentorId: data.mentorId,
            weeklySlots: data.weeklySlots.map(d => ({
                day: d.day,
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

        return generateMonthlyAvailability(data.weeklySlots, year, month);
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
            startTime: displayHour.toString(),
            startPeriod: selectedPeriod,
            endTime: endDisplayHour.toString(),
            endPeriod: endPeriod
        };

        // Check availability
        const dayAvailability = availability.weeklySlots.find(d => d.day === weekday);
        if (!dayAvailability || dayAvailability.slots.length === 0)
            throw new BadRequestException("Mentor is not available on this day.");

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

        // Restore old slot 
        const oldMeetingUtc = new Date(appointment.meetingDate);
        const oldLocal = new Date(oldMeetingUtc.getTime() + IST_OFFSET);

        const oldWeekday = oldLocal.getUTCDay();
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
            startTime: oldDisplay.toString(),
            startPeriod: oldPeriod,
            endTime: oldEndDisplay.toString(),
            endPeriod: oldEndPeriod
        };

        // Update availability: push old, pull new
        await this.availabilityModel.updateOne(
            { mentorId, "weeklySlots.day": oldWeekday },
            { $push: { "weeklySlots.$.slots": oldSlot } }
        );

        await this.availabilityModel.updateOne(
            { mentorId, "weeklySlots.day": weekday },
            { $pull: { "weeklySlots.$.slots": selectedSlot } }
        );

        // Update appointment
        const updated = await this.populateBase(
            this.appointmentModel.findByIdAndUpdate(
                appointmentId,
                {
                    $set: {
                        meetingDate: meetingDateUtc,
                        endTime: newEndUtc,
                        status: "rescheduled"
                    }
                },
                { new: true }
            )
        ).lean();

        return toAppointmentResponseDto(updated as AppointmentDocument);
    }

    async cancel(appointmentId: string, dto: { reason?: string }) {
        const IST_OFFSET = 5.5 * 3600 * 1000;

        // load appointment
        const appointment = await this.appointmentModel.findById(appointmentId).lean();
        if (!appointment) throw new NotFoundException("Appointment not found.");

        // only scheduled appointments can be cancelled
        if (appointment.status !== APPOINTMENT_STATUSES.SCHEDULED) {
            throw new BadRequestException("Only scheduled appointments can be cancelled.");
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
            startTime: oldDisplay.toString(),
            startPeriod: oldPeriod,
            endTime: oldEndDisplay.toString(),
            endPeriod: oldEndPeriod
        };

        // push slot back into availability
        await this.availabilityModel.updateOne(
            { mentorId, "weeklySlots.day": oldWeekday },
            { $push: { "weeklySlots.$.slots": oldSlot } }
        );

        // update appointment to cancelled
        const cancelledStatus = (APPOINTMENT_STATUSES && (APPOINTMENT_STATUSES.CANCELED ?? APPOINTMENT_STATUSES.CANCELED)) || 'canceled';

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

        } catch (err) {
            console.warn('Failed to send cancellation notifications:', err?.message ?? err);
        }


        return toAppointmentResponseDto(updated as AppointmentDocument);
    }
}