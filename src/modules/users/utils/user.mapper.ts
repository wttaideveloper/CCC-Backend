import { UserDocument } from '../schemas/user.schema';
import { UserResponseDto } from '../dto/user-response.dto';

export function toUserResponseDto(user: UserDocument): UserResponseDto {

    return {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
    };
}