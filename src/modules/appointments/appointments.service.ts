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

@Injectable()
export class AppointmentsService {
    constructor(
        @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
        @InjectModel(Availability.name) private availabilityModel: Model<AvailabilityDocument>,
    ) { }

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

        return toAppointmentResponseDto(saved);
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

        const appointments = await this.appointmentModel
            .find(query)
            .sort({ meetingDate: 1 })
            .exec();

        return appointments.map(toAppointmentResponseDto);
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
        const data = await this.availabilityModel.findOne({ mentorId }).lean();
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

    async reschedule(
        appointmentId: string,
        dto: { newDate: string }
    ) {
        const appointment = await this.appointmentModel.findById(appointmentId).lean();
        if (!appointment) {
            throw new BadRequestException("Appointment not found.");
        }

        const mentorId = appointment.mentorId;
        const availability = await this.availabilityModel.findOne({ mentorId }).lean();

        if (!availability) {
            throw new BadRequestException("Mentor has no availability set.");
        }

        const meetingDateUtc = new Date(dto.newDate);
        const meetingInMentorTz = new Date(meetingDateUtc.getTime() + 5.5 * 3600 * 1000);

        const weekday = meetingInMentorTz.getUTCDay();
        const selectedHour24 = meetingInMentorTz.getUTCHours();
        const minute = meetingInMentorTz.getUTCMinutes();

        if (minute !== 0) {
            throw new BadRequestException("Time must start exactly at the hour.");
        }

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
            throw new BadRequestException("Selected slot is not available.");
        }

        const newEndTime = new Date(meetingDateUtc.getTime() + 3600 * 1000);

        const overlap = await this.appointmentModel.findOne({
            mentorId,
            _id: { $ne: appointmentId },
            meetingDate: { $lt: newEndTime },
            endTime: { $gt: meetingDateUtc },
            status: APPOINTMENT_STATUSES.SCHEDULED
        });

        if (overlap) {
            throw new BadRequestException("This slot is already booked by another appointment.");
        }

        const oldMeetingLocal = new Date(appointment.meetingDate.getTime() + 5.5 * 3600 * 1000);
        const oldWeekday = oldMeetingLocal.getUTCDay();
        const oldHour = oldMeetingLocal.getUTCHours();
        const oldPeriod = oldHour >= 12 ? "PM" : "AM";
        let oldDisplay = oldHour % 12;
        if (oldDisplay === 0) oldDisplay = 12;

        const oldSlot = {
            startTime: oldDisplay.toString(),
            startPeriod: oldPeriod
        };

        await this.availabilityModel.updateOne(
            { mentorId, "weeklySlots.day": oldWeekday },
            {
                $push: {
                    "weeklySlots.$.slots": oldSlot
                }
            }
        );

        await this.availabilityModel.updateOne(
            { mentorId, "weeklySlots.day": weekday },
            {
                $pull: {
                    "weeklySlots.$.slots": selectedSlot
                }
            }
        );

        await this.appointmentModel.updateOne(
            { _id: new Types.ObjectId(appointmentId) },
            {
                $set: {
                    meetingDate: meetingDateUtc,
                    endTime: newEndTime,
                    status: "rescheduled"
                }
            }
        );

        return {
            appointmentId,
            meetingDate: meetingDateUtc,
            endTime: newEndTime,
            status: "rescheduled"
        };
    }

}