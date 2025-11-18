import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument } from './schemas/appointment.schema';
import { CreateAppointmentDto, AppointmentResponseDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { toAppointmentResponseDto } from './utils/appointment.mapper';
import { APPOINTMENT_STATUSES } from '../../common/constants/status.constants';
import { Availability, AvailabilityDocument } from './schemas/availability.schema';
import { AvailabilityDto } from './dto/availability.dto';
import { convertSlotToMinutes, convertToMinutes, generateMonthlyAvailability, splitIntoDurationSlots } from './utils/availability.utils';

@Injectable()
export class AppointmentsService {
    constructor(
        @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
        @InjectModel(Availability.name) private availabilityModel: Model<AvailabilityDocument>,
    ) { }

    async create(dto: CreateAppointmentDto): Promise<AppointmentResponseDto> {
        const meetingDate = new Date(dto.meetingDate);
        console.log(dto.mentorId)
        const mentorId = new Types.ObjectId(dto.mentorId);

        const availability = await this.availabilityModel.findOne({ mentorId }).lean();
        if (!availability) {
            throw new BadRequestException("Mentor has no availability set.");
        }

        const weekday = meetingDate.getDay();
        const dayAvailability = availability.weeklySlots.find(d => d.day === weekday);

        if (!dayAvailability || dayAvailability.slots.length === 0) {
            throw new BadRequestException("Mentor is not available on this day.");
        }

        const selectedStart = meetingDate.getHours();
        const selectedMinute = meetingDate.getMinutes();

        const selectedPeriod = selectedStart >= 12 ? "PM" : "AM";
        const displayHour = selectedStart % 12 === 0 ? 12 : selectedStart % 12;

        // The exact slot user is trying to book
        const selectedSlot = {
            startTime: displayHour.toString(),
            startPeriod: selectedPeriod
        };

        // Check slot exists
        const slotExists = dayAvailability.slots.some(s =>
            s.startTime === selectedSlot.startTime &&
            s.startPeriod === selectedSlot.startPeriod
        );

        if (!slotExists) {
            throw new BadRequestException("This slot is not available.");
        }

        // Check mentor is free (no overlap)
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

        // Create appointment
        const appointment = new this.appointmentModel({
            ...dto,
            userId: new Types.ObjectId(dto.userId),
            mentorId,
            meetingDate,
            endTime
        });
        const saved = await appointment.save();

        // REMOVE the booked slot from availability
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

        if (appointments.length === 0 && futureOnly) {
            throw new NotFoundException(`No scheduled appointments found for this ${role}.`);
        }

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
            { mentorId: dto.mentorId },
            {
                $set: {
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
        const data = await this.availabilityModel.findOne({ mentorId }).lean();

        if (!data) {
            return [];
        }

        return generateMonthlyAvailability(data.weeklySlots, year, month);
    }

    async reschedule(
        appointmentId: string,
        dto: { newDate: string; startTime: string; startPeriod: 'AM' | 'PM' }
    ) {

        const { newDate, startTime, startPeriod } = dto;

        const meetingDate = new Date(newDate);
        const mentorId = (await this.appointmentModel.findById(appointmentId).lean())?.mentorId;
        if (!mentorId) {
            throw new BadRequestException("Appointment not found.");
        }

        const availability = await this.availabilityModel.findOne({ mentorId }).lean();

        if (!availability) {
            throw new BadRequestException("No availability");
        }

        const weekday = meetingDate.getDay();
        const dayAvailability = availability.weeklySlots.find(d => d.day === weekday);

        if (!dayAvailability || dayAvailability.slots.length === 0) {
            throw new BadRequestException("No availability on this day");
        }

        const chosenSlotMinutes = convertSlotToMinutes(startTime, startPeriod);

        const matchingSlot = dayAvailability.slots.find(slot => {
            return (
                convertSlotToMinutes(slot.startTime, slot.startPeriod) === chosenSlotMinutes
            );
        });

        if (!matchingSlot) {
            throw new BadRequestException("Selected slot is not available");
        }

        const endTime = new Date(meetingDate.getTime() + 60 * 60 * 1000);

        await this.appointmentModel.updateOne(
            { _id: new Types.ObjectId(appointmentId) },
            {
                $set: {
                    meetingDate,
                    endTime,
                    status: 'rescheduled'
                }
            }
        );

        return {
            appointmentId,
            meetingDate,
            endTime,
            status: 'rescheduled'
        };
    }

}