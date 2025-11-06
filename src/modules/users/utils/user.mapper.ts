import { UserDocument } from '../schemas/user.schema';
import { UserResponseDto } from '../dto/user-response.dto';

export function toUserResponseDto(user: UserDocument | any): UserResponseDto {

    return {
        id: user._id?.toString() || String(user._id),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        roleId: user.roleId,
        profilePicture: user.profilePicture,
        interestId: user.interestId?.toString(),
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}