import { IsString, IsNotEmpty } from 'class-validator';
import { PopulatedUserResponseDto } from './populated-response.dto';

export class CreateQueryDto {
    @IsNotEmpty()
    @IsString()
    actualQueryText: string;

    @IsNotEmpty()
    @IsString()
    userId: string;
}

export class ReplyQueryDto {
    @IsNotEmpty()
    @IsString()
    repliedAnswer: string;

    @IsNotEmpty()
    @IsString()
    repliedMentorId: string;
}

export class QueryItemResponseDto {
    _id: string;
    actualQueryText: string;
    createdDate: Date;
    repliedAnswer?: string;
    repliedDate?: Date;
    repliedMentorId?: PopulatedUserResponseDto;
    status: 'pending' | 'answered';
}

export class QueriesThreadResponseDto {
    _id: string;
    userId: string;
    roadMapId: string;
    queries: QueryItemResponseDto[];
    // createdAt: Date;
    // updatedAt: Date;
}