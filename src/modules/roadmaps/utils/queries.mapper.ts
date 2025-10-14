import { Types } from 'mongoose';
import { QueriesDocument, QueryItemDocument } from '../schemas/queries.schema';
import { QueryItemResponseDto, QueriesThreadResponseDto } from '../dto/queries.dto';
import { mapUserToDto } from './comments.mapper';
import { PopulatedUserResponseDto } from '../dto/populated-response.dto';


const toQueryItemResponseDto = (item: QueryItemDocument): QueryItemResponseDto => {
    const mentorDetails = mapUserToDto(item.repliedMentorId);

    return {
        _id: item._id.toString(),
        actualQueryText: item.actualQueryText,
        createdDate: item.createdDate,
        repliedAnswer: item.repliedAnswer,
        repliedDate: item.repliedDate,
        repliedMentorId: mentorDetails as PopulatedUserResponseDto,
        status: item.status,
    };
};

export const toQueriesThreadResponseDto = (doc: QueriesDocument): QueriesThreadResponseDto => ({
    _id: doc._id.toString(),
    userId: doc.userId.toString(),
    roadMapId: doc.roadMapId.toString(),
    queries: doc.queries.map(toQueryItemResponseDto),
    // createdAt: doc.createdAt,
    // updatedAt: doc.updatedAt,
});