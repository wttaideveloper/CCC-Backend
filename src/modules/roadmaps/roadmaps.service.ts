import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoadMap, RoadMapDocument } from './schemas/roadmap.schema';
import { CommentItem, Comments, CommentsDocument } from './schemas/comments.schema';
import { CreateRoadMapDto, RoadMapResponseDto, UpdateRoadMapDto, UpdateNestedRoadMapItemDto, NestedRoadMapItemDto } from './dto/roadmap.dto';
import { toRoadMapResponseDto } from './utils/roadmaps.mapper';
import { Queries, QueriesDocument, QueryItem } from './schemas/queries.schema';
import { AddCommentDto, CommentsThreadResponseDto } from './dto/comments.dto';
import { CreateQueryDto, QueriesThreadResponseDto, ReplyQueryDto } from './dto/queries.dto';
import { toCommentsThreadResponseDto } from './utils/comments.mapper';
import { toQueriesThreadResponseDto } from './utils/queries.mapper';
import { VALID_ROADMAP_STATUSES, ROADMAP_STATUSES, QUERY_STATUSES } from '../../common/constants/status.constants';
import { Extras, ExtrasDocument } from './schemas/extras.schema';
import { CreateExtrasDto, UpdateExtrasDto, ExtrasResponseDto, ExtrasDocumentDto } from './dto/extras.dto';
import { toExtrasResponseDto } from './utils/extras.mapper';
import { Progress, ProgressDocument } from '../progress/schemas/progress.schema';
import { toObjectId } from 'src/common/pipes/to-object-id.pipe';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class RoadMapsService {
    constructor(
        @InjectModel(RoadMap.name) private roadMapModel: Model<RoadMapDocument>,
        @InjectModel(Comments.name) private commentsModel: Model<CommentsDocument>,
        @InjectModel(Queries.name) private queriesModel: Model<QueriesDocument>,
        @InjectModel(Extras.name) private extrasModel: Model<ExtrasDocument>,
        @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
        private readonly s3Service: S3Service,
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

    async addNestedRoadMap(roadMapId: string, dto: NestedRoadMapItemDto): Promise<RoadMapResponseDto> {
        const roadMapObjectId = new Types.ObjectId(roadMapId);
        const nestedRoadmapTotalSteps = dto.totalSteps || 0;

        const updatedRoadmap = await this.roadMapModel.findByIdAndUpdate(
            roadMapObjectId,
            {
                $push: { roadmaps: dto },
                $inc: { totalSteps: nestedRoadmapTotalSteps },
                haveNextedRoadMaps: true,
            },
            {
                new: true,
                runValidators: true,
            }
        ).lean().exec();

        if (!updatedRoadmap) {
            throw new NotFoundException(`RoadMap with ID "${roadMapId}" not found`);
        }

        const nestedRoadmaps = updatedRoadmap.roadmaps || [];
        const newNestedRoadmap = nestedRoadmaps[nestedRoadmaps.length - 1];

        if (newNestedRoadmap) {
            await this.progressModel.updateMany(
                { 'roadmaps.roadMapId': roadMapObjectId },
                {
                    $push: {
                        'roadmaps.$[roadmap].nestedRoadmaps': {
                            nestedRoadmapId: newNestedRoadmap._id,
                            completedSteps: 0,
                            totalSteps: nestedRoadmapTotalSteps,
                            progressPercentage: 0,
                            status: 'not_started',
                        }
                    },
                    $inc: {
                        'roadmaps.$[roadmap].totalSteps': nestedRoadmapTotalSteps,
                    }
                },
                {
                    arrayFilters: [
                        { 'roadmap.roadMapId': roadMapObjectId }
                    ]
                }
            ).exec();
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
        const roadMapObjectId = toObjectId(roadMapId);
        const userObjectId = toObjectId(dto.userId);
        const userIdString = userObjectId?.toString();

        const nestedRoadMapItemObjectId = toObjectId(dto.nestedRoadMapItemId);

        if (!roadMapObjectId || !userObjectId) {
            throw new BadRequestException('Invalid RoadMap ID or User ID provided.');
        }

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
            const userIdFlexibleQuery = {
                $or: [
                    { userId: userObjectId },
                    { userId: userIdString }
                ]
            };

            if (nestedRoadMapItemObjectId) {
                // Update nested roadmap progress AND main roadmap progress
                await this.progressModel.findOneAndUpdate(
                    {
                        ...userIdFlexibleQuery,
                        'roadmaps.roadMapId': roadMapObjectId,
                        'roadmaps.nestedRoadmaps.nestedRoadmapId': nestedRoadMapItemObjectId
                    },
                    {
                        $inc: {
                            'roadmaps.$[roadmap].nestedRoadmaps.$[nested].completedSteps': dto.extras.length,
                            'roadmaps.$[roadmap].completedSteps': dto.extras.length
                        },
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
                    {
                        ...userIdFlexibleQuery,
                        'roadmaps.roadMapId': roadMapObjectId
                    },
                    {
                        $inc: { 'roadmaps.$.completedSteps': dto.extras.length },
                    },
                    { new: true }
                ).exec();
            }
        }

        return toExtrasResponseDto(updatedExtras as any);
    }

    async updateExtras(roadMapId: string, userId: string, dto: UpdateExtrasDto, nestedRoadMapItemId?: string): Promise<ExtrasResponseDto> {
        const roadMapObjectId = toObjectId(roadMapId);
        const userObjectId = toObjectId(userId);
        const userIdString = userObjectId?.toString();

        const nestedRoadMapItemObjectId = toObjectId(nestedRoadMapItemId);

        if (!roadMapObjectId || !userObjectId) {
            throw new BadRequestException('Invalid RoadMap ID or User ID provided.');
        }

        const query: any = {
            roadMapId: roadMapObjectId,
            userId: userObjectId,
        };

        if (nestedRoadMapItemObjectId) {
            query.nestedRoadMapItemId = nestedRoadMapItemObjectId;
        } else {
            query.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        const existingExtras = await this.extrasModel.findOne(query).lean().exec();
        if (!existingExtras) {
            throw new NotFoundException(`Extras not found for user ${userId} and roadmap ${roadMapId}`);
        }

        const newItemsCount = dto.extras?.length || 0;

        const updatedExtras = await this.extrasModel.findOneAndUpdate(
            query,
            { $push: { extras: { $each: dto.extras || [] } } },
            { new: true, runValidators: true }
        )
            .lean()
            .exec();

        if (!updatedExtras) {
            throw new NotFoundException(`Extras not found for user ${userId} and roadmap ${roadMapId}`);
        }

        // Update progress: increment completedSteps by the number of new items added
        if (newItemsCount > 0) {
            const userIdFlexibleQuery = {
                $or: [
                    { userId: userObjectId },
                    { userId: userIdString }
                ]
            };

            if (nestedRoadMapItemObjectId) {
                // Update nested roadmap progress AND main roadmap progress
                await this.progressModel.findOneAndUpdate(
                    {
                        ...userIdFlexibleQuery,
                        'roadmaps.roadMapId': roadMapObjectId,
                        'roadmaps.nestedRoadmaps.nestedRoadmapId': nestedRoadMapItemObjectId
                    },
                    {
                        $inc: {
                            'roadmaps.$[roadmap].nestedRoadmaps.$[nested].completedSteps': newItemsCount,
                            'roadmaps.$[roadmap].completedSteps': newItemsCount
                        },
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
                await this.progressModel.findOneAndUpdate(
                    {
                        ...userIdFlexibleQuery,
                        'roadmaps.roadMapId': roadMapObjectId
                    },
                    {
                        $inc: { 'roadmaps.$.completedSteps': newItemsCount },
                    },
                    { new: true }
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

    async uploadExtrasDocument(
        roadMapId: string,
        userId: string,
        file: Express.Multer.File,
        nestedRoadMapItemId?: string
    ): Promise<ExtrasDocumentDto> {
        const roadMapObjectId = toObjectId(roadMapId);
        const userObjectId = toObjectId(userId);
        const nestedRoadMapItemObjectId = toObjectId(nestedRoadMapItemId);

        if (!roadMapObjectId || !userObjectId) {
            throw new BadRequestException('Invalid RoadMap ID or User ID provided');
        }

        // Validate file type and size
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
            'image/jpg',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            throw new BadRequestException(
                'Invalid file type. Only PDF, Word, Excel, and images are allowed'
            );
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            throw new BadRequestException('File size exceeds 10MB limit');
        }

        // Upload to S3
        const key = `roadmaps/${roadMapId}/extras/${userId}/${Date.now()}-${file.originalname}`;
        const fileUrl = await this.s3Service.uploadFile(key, file.buffer, file.mimetype);

        const documentData: ExtrasDocumentDto = {
            fileName: file.originalname,
            fileUrl: fileUrl,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadedAt: new Date(),
        };

        const query: any = {
            roadMapId: roadMapObjectId,
            userId: userObjectId,
        };

        if (nestedRoadMapItemObjectId) {
            query.nestedRoadMapItemId = nestedRoadMapItemObjectId;
        } else {
            query.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        await this.extrasModel.findOneAndUpdate(
            query,
            {
                $push: { uploadedDocuments: documentData },
                $setOnInsert: {
                    roadMapId: roadMapObjectId,
                    userId: userObjectId,
                    nestedRoadMapItemId: nestedRoadMapItemObjectId,
                    extras: [],
                }
            },
            { upsert: true, new: true }
        ).exec();

        return documentData;
    }

    async getExtrasDocuments(
        roadMapId: string,
        userId: string,
        nestedRoadMapItemId?: string
    ): Promise<ExtrasDocumentDto[]> {
        const roadMapObjectId = toObjectId(roadMapId);
        const userObjectId = toObjectId(userId);
        const nestedRoadMapItemObjectId = toObjectId(nestedRoadMapItemId);

        if (!roadMapObjectId || !userObjectId) {
            throw new BadRequestException('Invalid RoadMap ID or User ID provided');
        }

        const query: any = {
            roadMapId: roadMapObjectId,
            userId: userObjectId,
        };

        if (nestedRoadMapItemObjectId) {
            query.nestedRoadMapItemId = nestedRoadMapItemObjectId;
        } else {
            query.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        const extras = await this.extrasModel.findOne(query).select('uploadedDocuments').lean().exec();

        if (!extras) {
            return [];
        }

        return extras.uploadedDocuments || [];
    }

    async deleteExtrasDocument(
        roadMapId: string,
        userId: string,
        fileUrl: string,
        nestedRoadMapItemId?: string
    ): Promise<{ message: string }> {
        const roadMapObjectId = toObjectId(roadMapId);
        const userObjectId = toObjectId(userId);
        const nestedRoadMapItemObjectId = toObjectId(nestedRoadMapItemId);

        if (!roadMapObjectId || !userObjectId) {
            throw new BadRequestException('Invalid RoadMap ID or User ID provided');
        }

        const query: any = {
            roadMapId: roadMapObjectId,
            userId: userObjectId,
        };

        if (nestedRoadMapItemObjectId) {
            query.nestedRoadMapItemId = nestedRoadMapItemObjectId;
        } else {
            query.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        const result = await this.extrasModel.findOneAndUpdate(
            query,
            { $pull: { uploadedDocuments: { fileUrl: fileUrl } } },
            { new: true }
        ).exec();

        if (!result) {
            throw new NotFoundException('Extras not found');
        }

        return { message: 'Document deleted successfully' };
    }
}