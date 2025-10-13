import { HomeDocument } from '../schemas/home.schema';
import { HomeResponseDto } from '../dto/home-response.dto';
import { UserDocument } from 'src/modules/users/schemas/user.schema';
import { MentorResponseDto } from '../dto/mentor-response.dto';

export function toHomeResponseDto(home: HomeDocument): HomeResponseDto {
    if (!home) {
        throw new Error('Home document not found for mapping.');
    }

    const obj = home.toObject({ getters: true });

    const dto = new HomeResponseDto();
    dto.id = obj._id.toString();
    dto.email = obj.email;
    dto.username = obj.username;

    dto.appointments = obj.appointments || [];
    dto.roadmaps = obj.roadmaps || [];
    dto.mentors = obj.mentors || [];

    return dto;
}

export function toMentorResponseDto(user: UserDocument): MentorResponseDto {
    if (!user) throw new Error('User document not found for mapping.');

    const obj = user.toObject({ getters: true });
    const dto = new MentorResponseDto();

    dto.id = obj._id.toString();
    dto.firstName = obj.firstName;
    dto.lastName = obj.lastName;
    dto.email = obj.email;
    dto.username = obj.username || '';
    dto.role = obj.role;
    dto.profileInfo = obj['profileInfo'] || '';

    return dto;
}