import { Types } from 'mongoose';
import { CommentsDocument, CommentItem, CommentItemDocument } from '../schemas/comments.schema';
import { CommentItemResponseDto, CommentsThreadResponseDto } from '../dto/comments.dto';
import { PopulatedUserResponseDto } from '../dto/populated-response.dto';

export const mapUserToDto = (userDoc: Types.ObjectId | any): PopulatedUserResponseDto | string => {
    if (userDoc && typeof userDoc === 'object' && userDoc._id) {
        return {
            _id: userDoc._id.toString(),
            email: userDoc.email,
            firstName: userDoc.firstName,
            lastName: userDoc.lastName,
            profilePicture: userDoc.profilePicture,
            role: userDoc.role,
        };
    }

    if (userDoc instanceof Types.ObjectId) {
        return userDoc.toString();
    }

    return "";
};


const toCommentItemResponseDto = (item: CommentItemDocument): CommentItemResponseDto => {
    const mentorDetails = mapUserToDto(item.mentorId);

    return {
        _id: item._id.toString(),
        text: item.text,
        addedDate: item.addedDate,
        mentorId: mentorDetails as PopulatedUserResponseDto,
    };
};

export const toCommentsThreadResponseDto = (doc: CommentsDocument): CommentsThreadResponseDto => ({
    _id: doc._id.toString(),
    userId: doc.userId.toString(),
    roadMapId: doc.roadMapId.toString(),
    comments: doc.comments.map(toCommentItemResponseDto),
    // createdAt: doc.createdAt,
    // updatedAt: doc.updatedAt,
});