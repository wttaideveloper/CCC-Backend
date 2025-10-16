import { AppointmentDocument } from '../schemas/appointment.schema';
import { AppointmentResponseDto } from '../dto/appointment.dto';

type AppointmentOutput = AppointmentDocument;

export const toAppointmentResponseDto = (appointment: AppointmentOutput): AppointmentResponseDto => {
    return {
        id: appointment._id.toString(),
        userId: appointment.userId.toString(),
        mentorId: appointment.mentorId.toString(),
        meetingDate: appointment.meetingDate,
        endTime: appointment.endTime,
        platform: appointment.platform,
        meetingLink: appointment.meetingLink,
        status: appointment.status,
    };
};