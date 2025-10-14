import { IsString, IsNotEmpty } from 'class-validator';
import { PopulatedUserResponseDto } from './populated-response.dto';

export class AddCommentDto {
    @IsNotEmpty()
    @IsString()
    text: string;

    @IsNotEmpty()
    @IsString()
    userId: string;

    @IsNotEmpty()
    @IsString()
    mentorId: string;
}

export class CommentItemResponseDto {
    _id: string;
    mentorId: PopulatedUserResponseDto;
    text: string;
    addedDate: Date;
}

export class CommentsThreadResponseDto {
    _id: string;
    userId: string;
    roadMapId: string;
    comments: CommentItemResponseDto[];
    // createdAt: Date;
    // updatedAt: Date;
}