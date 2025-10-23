import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoadMap, RoadMapDocument } from './schemas/roadmap.schema';
import { CommentItem, Comments, CommentsDocument } from './schemas/comments.schema';
import { CreateRoadMapDto, RoadMapResponseDto, UpdateRoadMapDto } from './dto/roadmap.dto';
import { toRoadMapResponseDto } from './utils/roadmaps.mapper';
import { Queries, QueriesDocument, QueryItem } from './schemas/queries.schema';
import { AddCommentDto, CommentsThreadResponseDto } from './dto/comments.dto';
import { CreateQueryDto, QueriesThreadResponseDto, ReplyQueryDto } from './dto/queries.dto';
import { toCommentsThreadResponseDto } from './utils/comments.mapper';
import { toQueriesThreadResponseDto } from './utils/queries.mapper';

@Injectable()
export class RoadMapsService {
    constructor(
        @InjectModel(RoadMap.name) private roadMapModel: Model<RoadMapDocument>,
        @InjectModel(Comments.name) private commentsModel: Model<CommentsDocument>,
        @InjectModel(Queries.name) private queriesModel: Model<QueriesDocument>,
    ) { }

    async create(dto: CreateRoadMapDto): Promise<RoadMapResponseDto> {
        const existing = await this.roadMapModel.findOne({ name: dto.name }).exec();
        if (existing) {
            throw new BadRequestException(`RoadMap with name '${dto.name}' already exists.`);
        }

        const roadMap = new this.roadMapModel(dto);
        const savedRoadMap = await roadMap.save();

        return toRoadMapResponseDto(savedRoadMap as RoadMapDocument);
    }

    async findAll(status: string, search: string): Promise<RoadMapResponseDto[]> {
        const query: any = {};

        const validStatuses = ['due', 'not started', 'completed'];
        const normalizedStatus = status?.toLowerCase();

        if (normalizedStatus && normalizedStatus !== 'all' && validStatuses.includes(normalizedStatus)) {
            query.status = normalizedStatus;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const roadmaps = await this.roadMapModel.find(query).exec();

        return roadmaps.map(rm => toRoadMapResponseDto(rm as RoadMapDocument));
    }

    async findById(id: string): Promise<RoadMapResponseDto> {
        const roadmap = await this.roadMapModel.findById(id).exec();

        if (!roadmap) {
            throw new NotFoundException(`RoadMap with ID "${id}" not found`);
        }

        return toRoadMapResponseDto(roadmap as RoadMapDocument);
    }

    async update(id: string, dto: UpdateRoadMapDto): Promise<RoadMapResponseDto> {
        if (dto.name) {
            const existing = await this.roadMapModel.findOne({
                name: dto.name,
                _id: { $ne: new Types.ObjectId(id) }
            }).exec();

            if (existing) {
                throw new BadRequestException(`RoadMap with name '${dto.name}' already exists.`);
            }
        }

        const updatedRoadmap = await this.roadMapModel.findByIdAndUpdate(id, dto, {
            new: true,
        }).exec();

        if (!updatedRoadmap) {
            throw new NotFoundException(`RoadMap with ID "${id}" not found`);
        }

        return toRoadMapResponseDto(updatedRoadmap as RoadMapDocument);
    }

    async delete(id: string): Promise<{ _id: string }> {
        const result = await this.roadMapModel.findByIdAndDelete(id).exec();

        if (!result) {
            throw new NotFoundException(`RoadMap with ID "${id}" not found`);
        }

        return { _id: id };
    }

    // async getRoadMap(id: string): Promise<{ roadmap: RoadMapResponseDto; comments: CommentsResponseDto }> {
    //     const roadmapDoc = await this.roadMapModel.findById(id).exec();

    //     if (!roadmapDoc) {
    //         throw new NotFoundException(`RoadMap with ID "${id}" not found`);
    //     }

    //     const comments = await this.commentsModel.find({ roadMapId: id }).exec();
    //     const roadmapDto = toRoadMapResponseDto(roadmapDoc as RoadMapDocument);

    //     return { roadmap: roadmapDto, comments };
    // }

    async getCommentThread(roadMapId: string, userId: string): Promise<CommentsThreadResponseDto> {
        const thread = await this.commentsModel.findOne({
            roadMapId: new Types.ObjectId(roadMapId),
            userId: new Types.ObjectId(userId)
        })
            .populate('comments.mentorId')
            .exec();

        if (!thread) {
            throw new NotFoundException(`Comment thread for user ${userId} on roadmap ${roadMapId} not found`);
        }

        return toCommentsThreadResponseDto(thread);
    }

    async addComment(roadMapId: string, dto: AddCommentDto): Promise<CommentsThreadResponseDto> {
        const roadMapObjectId = new Types.ObjectId(roadMapId);
        const userObjectId = new Types.ObjectId(dto.userId);

        const newComment: CommentItem = {
            mentorId: new Types.ObjectId(dto.mentorId),
            text: dto.text,
            addedDate: new Date(),
        } as CommentItem;

        const updatedThread = await this.commentsModel.findOneAndUpdate(
            { roadMapId: roadMapObjectId, userId: userObjectId },
            {
                $push: { comments: newComment },
                $setOnInsert: { roadMapId: roadMapObjectId, userId: userObjectId }
            },
            { new: true, upsert: true }
        ).exec();

        return toCommentsThreadResponseDto(updatedThread);
    }

    async getAllQueryThreads(roadMapId: string, userId: string, status?: string): Promise<QueriesThreadResponseDto[]> {
        const roadMapObjectId = new Types.ObjectId(roadMapId);
        const userObjectId = new Types.ObjectId(userId);

        const pipeline: any[] = [
            { $match: { roadMapId: roadMapObjectId, userId: userObjectId } },

            { $unwind: '$queries' },

            ...(status ? [{ $match: { 'queries.status': status } }] : []),

            {
                $lookup: {
                    from: 'users',
                    let: { mentorId: '$queries.repliedMentorId', queryStatus: '$queries.status' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$$mentorId', '$_id'] },
                                        { $eq: ['$$queryStatus', 'answered'] }
                                    ]
                                }
                            }
                        },
                        { $project: { _id: 1, email: 1, firstName: 1, lastName: 1, profilePicture: 1, role: 1 } }
                    ],
                    as: 'populatedMentor'
                }
            },

            {
                $set: {
                    'queries.repliedMentorId': {
                        $cond: {
                            if: { $ne: ['$populatedMentor', []] },
                            then: { $arrayElemAt: ['$populatedMentor', 0] },
                            else: '$queries.repliedMentorId'
                        }
                    }
                }
            },

            { $unset: 'populatedMentor' },

            {
                $group: {
                    _id: '$_id',
                    userId: { $first: '$userId' },
                    roadMapId: { $first: '$roadMapId' },
                    queries: { $push: '$queries' },
                },
            },
        ];

        const threads = await this.queriesModel.aggregate(pipeline).exec();
        return threads.map(toQueriesThreadResponseDto);
    }

    async addQuery(roadMapId: string, dto: CreateQueryDto): Promise<QueriesThreadResponseDto> {
        const roadMapObjectId = new Types.ObjectId(roadMapId);
        const userObjectId = new Types.ObjectId(dto.userId);

        const newQuery: QueryItem = {
            actualQueryText: dto.actualQueryText,
            createdDate: new Date(),
            status: 'pending',
        } as QueryItem;

        const updatedThread = await this.queriesModel.findOneAndUpdate(
            { roadMapId: roadMapObjectId, userId: userObjectId },
            {
                $push: { queries: newQuery },
                $setOnInsert: { roadMapId: roadMapObjectId, userId: userObjectId }
            },
            { new: true, upsert: true }
        ).exec();

        return toQueriesThreadResponseDto(updatedThread);
    }

    async replyQuery(roadMapId: string, queryItemId: string, dto: ReplyQueryDto): Promise<QueriesThreadResponseDto> {
        const mentorObjectId = new Types.ObjectId(dto.repliedMentorId);
        const queryItemObjectId = new Types.ObjectId(queryItemId);
        const roadMapObjectId = new Types.ObjectId(roadMapId)

        const updatedThread = await this.queriesModel.findOneAndUpdate(
            {
                roadMapId: roadMapObjectId,
                'queries._id': queryItemObjectId
            },
            {
                $set: {
                    'queries.$.repliedAnswer': dto.repliedAnswer,
                    'queries.$.repliedDate': new Date(),
                    'queries.$.repliedMentorId': mentorObjectId,
                    'queries.$.status': 'answered',
                }
            },
            { new: true }
        ).exec();

        if (!updatedThread) {
            throw new NotFoundException(`Query thread or item ID ${queryItemId} not found.`);
        }

        return toQueriesThreadResponseDto(updatedThread);
    }
}