import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoadMap, RoadMapDocument } from './schemas/roadmap.schema';
import { CommentItem, Comments, CommentsDocument } from './schemas/comments.schema';
import { CreateRoadMapDto, RoadMapResponseDto, UpdateRoadMapDto, UpdateNestedRoadMapItemDto } from './dto/roadmap.dto';
import { toRoadMapResponseDto } from './utils/roadmaps.mapper';
import { Queries, QueriesDocument, QueryItem } from './schemas/queries.schema';
import { AddCommentDto, CommentsThreadResponseDto } from './dto/comments.dto';
import { CreateQueryDto, QueriesThreadResponseDto, ReplyQueryDto } from './dto/queries.dto';
import { toCommentsThreadResponseDto } from './utils/comments.mapper';
import { toQueriesThreadResponseDto } from './utils/queries.mapper';
import { VALID_ROADMAP_STATUSES, ROADMAP_STATUSES, QUERY_STATUSES } from '../../common/constants/status.constants';
import { Extras, ExtrasDocument } from './schemas/extras.schema';
import { CreateExtrasDto, UpdateExtrasDto, ExtrasResponseDto } from './dto/extras.dto';
import { toExtrasResponseDto } from './utils/extras.mapper';
import { Progress, ProgressDocument } from '../progress/schemas/progress.schema';

@Injectable()
export class RoadMapsService {
    constructor(
        @InjectModel(RoadMap.name) private roadMapModel: Model<RoadMapDocument>,
        @InjectModel(Comments.name) private commentsModel: Model<CommentsDocument>,
        @InjectModel(Queries.name) private queriesModel: Model<QueriesDocument>,
        @InjectModel(Extras.name) private extrasModel: Model<ExtrasDocument>,
        @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
    ) { }

    async create(dto: CreateRoadMapDto): Promise<RoadMapResponseDto> {
        const existing = await this.roadMapModel.findOne({ name: dto.name }).lean().exec();
        if (existing) {
            throw new BadRequestException(`RoadMap with name '${dto.name}' already exists.`);
        }

        const roadMap = await this.roadMapModel.create(dto);
        return toRoadMapResponseDto(roadMap);
    }

    async findAll(status: string, search: string): Promise<RoadMapResponseDto[]> {
        const query: any = {};

        const normalizedStatus = status?.toLowerCase();

        if (normalizedStatus && normalizedStatus !== ROADMAP_STATUSES.ALL && VALID_ROADMAP_STATUSES.includes(normalizedStatus as any)) {
            query.status = normalizedStatus;
        }

        if (search) {
            // Escape special regex characters to prevent ReDoS attacks
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.name = { $regex: escapedSearch, $options: 'i' };
        }

        const roadmaps = await this.roadMapModel.find(query).lean().exec();
        return roadmaps.map(rm => toRoadMapResponseDto(rm as any));
    }

    async findById(id: string): Promise<RoadMapResponseDto> {
        const roadmap = await this.roadMapModel.findById(id).lean().exec();

        if (!roadmap) {
            throw new NotFoundException(`RoadMap with ID "${id}" not found`);
        }

        return toRoadMapResponseDto(roadmap as any);
    }

    async update(id: string, dto: UpdateRoadMapDto): Promise<RoadMapResponseDto> {
        if (dto.name) {
            const existing = await this.roadMapModel.findOne({
                name: dto.name,
                _id: { $ne: new Types.ObjectId(id) }
            }).lean().exec();

            if (existing) {
                throw new BadRequestException(`RoadMap with name '${dto.name}' already exists.`);
            }
        }

        const updatedRoadmap = await this.roadMapModel.findByIdAndUpdate(id, dto, {
            new: true,
            runValidators: true
        }).lean().exec();

        if (!updatedRoadmap) {
            throw new NotFoundException(`RoadMap with ID "${id}" not found`);
        }

        return toRoadMapResponseDto(updatedRoadmap);
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
            .lean()
            .exec();

        if (!thread) {
            throw new NotFoundException(`Comment thread for user ${userId} on roadmap ${roadMapId} not found`);
        }

        return toCommentsThreadResponseDto(thread as any);
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
        )
            .lean()
            .exec();

        return toCommentsThreadResponseDto(updatedThread as any);
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
                                        { $eq: ['$$queryStatus', QUERY_STATUSES.ANSWERED] }
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
            status: QUERY_STATUSES.PENDING,
        } as QueryItem;

        const updatedThread = await this.queriesModel.findOneAndUpdate(
            { roadMapId: roadMapObjectId, userId: userObjectId },
            {
                $push: { queries: newQuery },
                $setOnInsert: { roadMapId: roadMapObjectId, userId: userObjectId }
            },
            { new: true, upsert: true }
        )
            .lean()
            .exec();

        return toQueriesThreadResponseDto(updatedThread as any);
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
                    'queries.$.status': QUERY_STATUSES.ANSWERED,
                }
            },
            { new: true }
        )
            .lean()
            .exec();

        if (!updatedThread) {
            throw new NotFoundException(`Query thread or item ID ${queryItemId} not found.`);
        }

        return toQueriesThreadResponseDto(updatedThread as any);
    }

    async updateNestedRoadMapItem(roadMapId: string, nestedItemId: string, dto: UpdateNestedRoadMapItemDto): Promise<RoadMapResponseDto> {
        const updateFields: any = {};

        Object.keys(dto).forEach(key => {
            if (dto[key] !== undefined) {
                updateFields[`roadmaps.$.${key}`] = dto[key];
            }
        });

        const updatedRoadmap = await this.roadMapModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(roadMapId),
                'roadmaps._id': new Types.ObjectId(nestedItemId)
            },
            { $set: updateFields },
            { new: true, runValidators: true }
        )
            .lean()
            .exec();

        if (!updatedRoadmap) {
            throw new NotFoundException(`RoadMap with ID "${roadMapId}" or nested item with ID "${nestedItemId}" not found`);
        }

        return toRoadMapResponseDto(updatedRoadmap);
    }

    async getExtras(roadMapId: string, userId: string, nestedRoadMapItemId?: string): Promise<ExtrasResponseDto | null> {
        const query: any = {
            roadMapId: new Types.ObjectId(roadMapId),
            userId: new Types.ObjectId(userId),
        };

        if (nestedRoadMapItemId) {
            query.nestedRoadMapItemId = new Types.ObjectId(nestedRoadMapItemId);
        } else {
            query.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        const extras = await this.extrasModel.findOne(query).lean().exec();
        return extras ? toExtrasResponseDto(extras as any) : null;
    }

    async saveExtras(roadMapId: string, dto: CreateExtrasDto): Promise<ExtrasResponseDto> {
        const roadMapObjectId = new Types.ObjectId(roadMapId);
        const userObjectId = new Types.ObjectId(dto.userId);
        const nestedRoadMapItemObjectId = dto.nestedRoadMapItemId
            ? new Types.ObjectId(dto.nestedRoadMapItemId)
            : null;

        const updatedExtras = await this.extrasModel.findOneAndUpdate(
            {
                roadMapId: roadMapObjectId,
                userId: userObjectId,
                nestedRoadMapItemId: nestedRoadMapItemObjectId
            },
            {
                $set: { extras: dto.extras || [] },
                $setOnInsert: {
                    roadMapId: roadMapObjectId,
                    userId: userObjectId,
                    nestedRoadMapItemId: nestedRoadMapItemObjectId
                }
            },
            { new: true, upsert: true, runValidators: true }
        )
            .lean()
            .exec();

        // Update progress: increment completedSteps by the number of extras
        if (dto.extras && dto.extras.length > 0) {
            if (nestedRoadMapItemObjectId) {
                // Update nested roadmap progress AND main roadmap progress
                await this.progressModel.findOneAndUpdate(
                    {
                        userId: userObjectId,
                        'roadmaps.roadMapId': roadMapObjectId,
                        'roadmaps.nestedRoadmaps.nestedRoadmapId': nestedRoadMapItemObjectId
                    },
                    {
                        $inc: {
                            'roadmaps.$[roadmap].nestedRoadmaps.$[nested].completedSteps': dto.extras.length,
                            'roadmaps.$[roadmap].completedSteps': dto.extras.length  // Also increment main roadmap
                        }
                    },
                    {
                        new: true,
                        arrayFilters: [
                            { 'roadmap.roadMapId': roadMapObjectId },
                            { 'nested.nestedRoadmapId': nestedRoadMapItemObjectId }
                        ]
                    }
                ).exec();
            } else {
                // Update main roadmap progress only
                await this.progressModel.findOneAndUpdate(
                    { userId: userObjectId, 'roadmaps.roadMapId': roadMapObjectId },
                    { $inc: { 'roadmaps.$.completedSteps': dto.extras.length } }
                ).exec();
            }
        }

        return toExtrasResponseDto(updatedExtras as any);
    }

    async updateExtras(roadMapId: string, userId: string, dto: UpdateExtrasDto, nestedRoadMapItemId?: string): Promise<ExtrasResponseDto> {
        const roadMapObjectId = new Types.ObjectId(roadMapId);
        const userObjectId = new Types.ObjectId(userId);

        const query: any = {
            roadMapId: roadMapObjectId,
            userId: userObjectId,
        };

        if (nestedRoadMapItemId) {
            query.nestedRoadMapItemId = new Types.ObjectId(nestedRoadMapItemId);
        } else {
            query.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        // Get the existing extras to calculate the difference in length
        const existingExtras = await this.extrasModel.findOne(query).lean().exec();
        if (!existingExtras) {
            throw new NotFoundException(`Extras not found for user ${userId} and roadmap ${roadMapId}`);
        }

        const oldExtrasCount = existingExtras.extras?.length || 0;
        const newExtrasCount = dto.extras?.length || 0;
        const difference = newExtrasCount - oldExtrasCount;

        const updatedExtras = await this.extrasModel.findOneAndUpdate(
            query,
            { $set: { extras: dto.extras } },
            { new: true, runValidators: true }
        )
            .lean()
            .exec();

        if (!updatedExtras) {
            throw new NotFoundException(`Extras not found for user ${userId} and roadmap ${roadMapId}`);
        }

        // Update progress: adjust completedSteps by the difference
        if (difference !== 0) {
            const nestedRoadMapItemObjectId = nestedRoadMapItemId ? new Types.ObjectId(nestedRoadMapItemId) : null;

            if (nestedRoadMapItemObjectId) {
                // Update nested roadmap progress AND main roadmap progress
                await this.progressModel.findOneAndUpdate(
                    {
                        userId: userObjectId,
                        'roadmaps.roadMapId': roadMapObjectId,
                        'roadmaps.nestedRoadmaps.nestedRoadmapId': nestedRoadMapItemObjectId
                    },
                    {
                        $inc: {
                            'roadmaps.$[roadmap].nestedRoadmaps.$[nested].completedSteps': difference,
                            'roadmaps.$[roadmap].completedSteps': difference  // Also update main roadmap
                        }
                    },
                    {
                        new: true,
                        arrayFilters: [
                            { 'roadmap.roadMapId': roadMapObjectId },
                            { 'nested.nestedRoadmapId': nestedRoadMapItemObjectId }
                        ]
                    }
                ).exec();
            } else {
                // Update main roadmap progress only
                await this.progressModel.findOneAndUpdate(
                    { userId: userObjectId, 'roadmaps.roadMapId': roadMapObjectId },
                    { $inc: { 'roadmaps.$.completedSteps': difference } }
                ).exec();
            }
        }

        return toExtrasResponseDto(updatedExtras as any);
    }

    async deleteExtras(roadMapId: string, userId: string, nestedRoadMapItemId?: string): Promise<{ message: string }> {
        const query: any = {
            roadMapId: new Types.ObjectId(roadMapId),
            userId: new Types.ObjectId(userId),
        };

        if (nestedRoadMapItemId) {
            query.nestedRoadMapItemId = new Types.ObjectId(nestedRoadMapItemId);
        } else {
            query.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        const result = await this.extrasModel.findOneAndDelete(query).lean().exec();
        if (!result) {
            throw new NotFoundException(`Extras not found for user ${userId} and roadmap ${roadMapId}`);
        }
        return { message: 'Extras deleted successfully' };
    }
}