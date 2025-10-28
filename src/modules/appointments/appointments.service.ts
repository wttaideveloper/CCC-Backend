import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument } from './schemas/appointment.schema';
import { CreateAppointmentDto, AppointmentResponseDto, UpdateAppointmentDto } from './dto/appointment.dto';
import { toAppointmentResponseDto } from './utils/appointment.mapper';
import { APPOINTMENT_STATUSES } from '../../common/constants/status.constants';

@Injectable()
export class AppointmentsService {
    constructor(
        @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    ) { }

    async create(dto: CreateAppointmentDto): Promise<AppointmentResponseDto> {
        const newMeetingDate = new Date(dto.meetingDate);
        const newEndTime = new Date(newMeetingDate.getTime() + 60 * 60 * 1000);

        const overlapQuery = {
            mentorId: new Types.ObjectId(dto.mentorId),
            status: APPOINTMENT_STATUSES.SCHEDULED,
            meetingDate: { $lt: newEndTime },
            endTime: { $gt: newMeetingDate },
        };

        const existingOverlap = await this.appointmentModel.findOne(overlapQuery).select('_id').lean().exec();

        if (existingOverlap) {
            throw new BadRequestException('Mentor is already scheduled for an overlapping appointment.');
        }

        const appointment = new this.appointmentModel({
            ...dto,
            userId: new Types.ObjectId(dto.userId),
            mentorId: new Types.ObjectId(dto.mentorId),
            meetingDate: newMeetingDate,
        });

        const savedAppointment = await appointment.save();
        return toAppointmentResponseDto(savedAppointment);
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
}