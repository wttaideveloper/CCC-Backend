import { HomeDocument } from '../schemas/home.schema';
import { HomeResponseDto } from '../dto/home-response.dto';

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