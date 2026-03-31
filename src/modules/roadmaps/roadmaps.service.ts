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
import { User, UserDocument } from '../users/schemas/user.schema';
import { Availability, AvailabilityDocument } from '../appointments/schemas/availability.schema';
import { buildMeetingDate, SESSION_FLOW, SESSION_NOTES } from './utils/helper';
import { AppointmentsService } from '../appointments/appointments.service';

@Injectable()
export class RoadMapsService {
    constructor(
        @InjectModel(RoadMap.name) private roadMapModel: Model<RoadMapDocument>,
        @InjectModel(Comments.name) private commentsModel: Model<CommentsDocument>,
        @InjectModel(Queries.name) private queriesModel: Model<QueriesDocument>,
        @InjectModel(Extras.name) private extrasModel: Model<ExtrasDocument>,
        @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Availability.name) private availabilityModel: Model<AvailabilityDocument>,
        private readonly s3Service: S3Service,
        private readonly appointmentService: AppointmentsService
    ) { }

    async create(dto: CreateRoadMapDto, image?: Express.Multer.File): Promise<RoadMapResponseDto> {
        const existing = await this.roadMapModel.findOne({ name: dto.name }).lean().exec();
        if (existing) {
            throw new BadRequestException(`RoadMap with name '${dto.name}' already exists.`);
        }

        let imageUrl: string | undefined;

        if (image) {
            const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedMimeTypes.includes(image.mimetype)) {
                throw new BadRequestException('Invalid file type. Only JPEG, PNG, and WebP are allowed');
            }

            const maxSize = 5 * 1024 * 1024; // 5MB
            if (image.size > maxSize) {
                throw new BadRequestException('File size exceeds 5MB limit');
            }

            const timestamp = Date.now();
            const fileExtension = image.originalname.split('.').pop();
            const key = `roadmaps/images/${timestamp}.${fileExtension}`;

            imageUrl = await this.s3Service.uploadFile(key, image.buffer, image.mimetype);
        }

        const roadmapsWithSteps = (dto.roadmaps || []).map(nested => ({
            ...nested,
            totalSteps: nested.totalSteps ?? (nested.extras?.length ?? 0),
        }));

        const nestedTotalSteps = roadmapsWithSteps.reduce(
            (sum, nested) => sum + nested.totalSteps,
            0
        );
        const mainExtrasSteps = dto.extras?.length ?? 0;
        const computedTotalSteps = dto.totalSteps ?? (mainExtrasSteps + nestedTotalSteps);

        const roadMap = await this.roadMapModel.create({
            ...dto,
            roadmaps: roadmapsWithSteps,
            totalSteps: computedTotalSteps,
            ...(imageUrl && { imageUrl }),
        });
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

    async update(id: string, dto: UpdateRoadMapDto, image?: Express.Multer.File): Promise<RoadMapResponseDto> {
        if (dto.name) {
            const existing = await this.roadMapModel.findOne({
                name: dto.name,
                _id: { $ne: new Types.ObjectId(id) }
            }).lean().exec();

            if (existing) {
                throw new BadRequestException(`RoadMap with name '${dto.name}' already exists.`);
            }
        }

        let imageUrl: string | undefined;

        if (image) {
            const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedMimeTypes.includes(image.mimetype)) {
                throw new BadRequestException('Invalid file type. Only JPEG, PNG, and WebP are allowed');
            }

            const maxSize = 5 * 1024 * 1024; // 5MB
            if (image.size > maxSize) {
                throw new BadRequestException('File size exceeds 5MB limit');
            }

            const timestamp = Date.now();
            const fileExtension = image.originalname.split('.').pop();
            const key = `roadmaps/${id}/images/${timestamp}.${fileExtension}`;

            imageUrl = await this.s3Service.uploadFile(key, image.buffer, image.mimetype);
        }

        const updatedRoadmap = await this.roadMapModel.findByIdAndUpdate(
            id,
            {
                ...dto,
                ...(imageUrl && { imageUrl }),
            },
            {
                new: true,
                runValidators: true
            }
        ).lean().exec();

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
            return { _id: '', userId, roadMapId, comments: [] };
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

    async updateNestedRoadMapItem(roadMapId: string, nestedItemId: string, dto: UpdateNestedRoadMapItemDto, image?: Express.Multer.File): Promise<RoadMapResponseDto> {
        const updateFields: any = {};

        Object.keys(dto).forEach(key => {
            if (dto[key] !== undefined) {
                updateFields[`roadmaps.$.${key}`] = dto[key];
            }
        });

        if (image) {
            const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedMimeTypes.includes(image.mimetype)) {
                throw new BadRequestException('Invalid file type. Only JPEG, PNG, and WebP are allowed');
            }

            const maxSize = 5 * 1024 * 1024; // 5MB
            if (image.size > maxSize) {
                throw new BadRequestException('File size exceeds 5MB limit');
            }

            const timestamp = Date.now();
            const fileExtension = image.originalname.split('.').pop();
            const key = `roadmaps/${roadMapId}/nested/${nestedItemId}/images/${timestamp}.${fileExtension}`;

            const imageUrl = await this.s3Service.uploadFile(key, image.buffer, image.mimetype);
            updateFields['roadmaps.$.imageUrl'] = imageUrl;
        }

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

    async addNestedRoadMap(roadMapId: string, dto: NestedRoadMapItemDto, image?: Express.Multer.File): Promise<RoadMapResponseDto> {
        const roadMapObjectId = new Types.ObjectId(roadMapId);
        const nestedRoadmapTotalSteps = dto.totalSteps ?? (dto.extras?.length ?? 0);

        let imageUrl: string | undefined;

        if (image) {
            const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedMimeTypes.includes(image.mimetype)) {
                throw new BadRequestException('Invalid file type. Only JPEG, PNG, and WebP are allowed');
            }

            const maxSize = 5 * 1024 * 1024; // 5MB
            if (image.size > maxSize) {
                throw new BadRequestException('File size exceeds 5MB limit');
            }

            const timestamp = Date.now();
            const fileExtension = image.originalname.split('.').pop();
            const key = `roadmaps/${roadMapId}/nested/images/${timestamp}.${fileExtension}`;

            imageUrl = await this.s3Service.uploadFile(key, image.buffer, image.mimetype);
        }

        const updatedRoadmap = await this.roadMapModel.findByIdAndUpdate(
            roadMapObjectId,
            {
                $push: {
                    roadmaps: {
                        ...dto,
                        ...(imageUrl && { imageUrl }),
                    }
                },
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

        // Build a consistent query that handles the null/missing nestedRoadMapItemId correctly
        const existsQuery: any = { roadMapId: roadMapObjectId, userId: userObjectId };
        if (nestedRoadMapItemObjectId) {
            existsQuery.nestedRoadMapItemId = nestedRoadMapItemObjectId;
        } else {
            existsQuery.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        // Guard: this is a first-time POST — reject if extras already exist
        const existing = await this.extrasModel.findOne(existsQuery).select('_id').lean().exec();
        if (existing) {
            throw new BadRequestException('Extras already exist for this roadmap. Use PATCH to add more extras.');
        }

        const now = new Date();
        const newExtras = (dto.extras || []).map(extra =>
            extra.type === 'SIGNATURE' && extra.signatureData && !extra.signedAt
                ? { ...extra, signedAt: now }
                : extra
        );
        let savedExtras: any;
        try {
            savedExtras = await this.extrasModel.create({
                roadMapId: roadMapObjectId,
                userId: userObjectId,
                nestedRoadMapItemId: nestedRoadMapItemObjectId ?? null,
                extras: newExtras,
            });
        } catch (err) {
            if (err?.code === 11000) {
                throw new BadRequestException('Extras already exist for this roadmap. Use PATCH to add more extras.');
            }
            throw err;
        }

        // Update progress by exact count of extras being saved
        if (newExtras.length > 0) {
            const userIdFlexibleQuery = {
                $or: [
                    { userId: userObjectId },
                    { userId: userIdString }
                ]
            };

            if (nestedRoadMapItemObjectId) {
                await this.progressModel.findOneAndUpdate(
                    {
                        ...userIdFlexibleQuery,
                        'roadmaps.roadMapId': roadMapObjectId,
                        'roadmaps.nestedRoadmaps.nestedRoadmapId': nestedRoadMapItemObjectId
                    },
                    {
                        $inc: {
                            'roadmaps.$[roadmap].nestedRoadmaps.$[nested].completedSteps': newExtras.length,
                            'roadmaps.$[roadmap].completedSteps': newExtras.length
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
                        $inc: { 'roadmaps.$.completedSteps': newExtras.length },
                    },
                    { new: true }
                ).exec();
            }
        }

        const isJumpstartCompleted = dto.extras?.some(
            (e: any) => e.type === 'JUMPSTART_COMPLETE'
        );

        if (isJumpstartCompleted) {
            await this.getMentorFromPastor(
                dto.userId
            );
        }

        return toExtrasResponseDto(savedExtras as any);
    }

    async updateExtras(roadMapId: string, userId: string, dto: UpdateExtrasDto, nestedRoadMapItemId?: string): Promise<ExtrasResponseDto> {
        const roadMapObjectId = toObjectId(roadMapId);
        const userObjectId = toObjectId(userId);
        const userIdString = userObjectId?.toString();
        const nestedRoadMapItemObjectId = toObjectId(nestedRoadMapItemId);

        if (!roadMapObjectId || !userObjectId) {
            throw new BadRequestException('Invalid RoadMap ID or User ID provided.');
        }

        const query: any = { roadMapId: roadMapObjectId, userId: userObjectId };
        if (nestedRoadMapItemObjectId) {
            query.nestedRoadMapItemId = nestedRoadMapItemObjectId;
        } else {
            query.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        const now = new Date();
        const incomingExtras = (dto.extras || []).map(extra =>
            extra.type === 'SIGNATURE' && extra.signatureData && !extra.signedAt
                ? { ...extra, signedAt: now }
                : extra
        );
        const newItemsCount = incomingExtras.length;

        const updatedExtras = await this.extrasModel.findOneAndUpdate(
            query,
            { $push: { extras: { $each: incomingExtras } } },
            { new: true, runValidators: true }
        ).lean().exec();

        if (!updatedExtras) {
            throw new NotFoundException(`Extras not found for user ${userId} and roadmap ${roadMapId}`);
        }

        if (newItemsCount > 0) {
            const userIdFlexibleQuery = {
                $or: [
                    { userId: userObjectId },
                    { userId: userIdString }
                ]
            };

            if (nestedRoadMapItemObjectId) {
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

    async uploadExtrasDocuments(
        roadMapId: string,
        userId: string,
        files: Express.Multer.File[],
        nestedRoadMapItemId?: string,
        name?: string
    ): Promise<ExtrasDocumentDto> {
        const roadMapObjectId = toObjectId(roadMapId);
        const userObjectId = toObjectId(userId);
        const nestedRoadMapItemObjectId = toObjectId(nestedRoadMapItemId);

        if (!roadMapObjectId || !userObjectId) {
            throw new BadRequestException('Invalid RoadMap ID or User ID provided');
        }

        if (!files || files.length === 0) {
            throw new BadRequestException('No files provided');
        }

        // Validate file types and sizes
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
            'image/jpg',
            'video/mp4',
            'video/mpeg',
            'video/quicktime',
        ];

        const maxSize = 10 * 1024 * 1024; // 10MB

        for (const file of files) {
            if (!allowedTypes.includes(file.mimetype)) {
                throw new BadRequestException(
                    `Invalid file type for ${file.originalname}. Only PDF, Word, Excel, images, and videos are allowed`
                );
            }

            if (file.size > maxSize) {
                throw new BadRequestException(`File ${file.originalname} size exceeds 10MB limit`);
            }
        }

        const uploadBatchId = new Types.ObjectId().toString();
        const timestamp = Date.now();

        // Upload all files to S3
        const uploadedFiles = await Promise.all(
            files.map(async (file) => {
                const key = `roadmaps/${roadMapId}/extras/${userId}/${uploadBatchId}/${timestamp}-${file.originalname}`;
                const fileUrl = await this.s3Service.uploadFile(key, file.buffer, file.mimetype);

                return {
                    fileName: file.originalname,
                    fileUrl: fileUrl,
                    fileType: file.mimetype,
                    fileSize: file.size,
                };
            })
        );

        const documentBatch: ExtrasDocumentDto = {
            uploadBatchId: uploadBatchId,
            uploadedAt: new Date(),
            name: name,
            files: uploadedFiles,
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
                $push: { uploadedDocuments: documentBatch },
                $setOnInsert: {
                    roadMapId: roadMapObjectId,
                    userId: userObjectId,
                    nestedRoadMapItemId: nestedRoadMapItemObjectId,
                    extras: [],
                }
            },
            { upsert: true, new: true }
        ).exec();

        return documentBatch;
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

    async deleteExtrasDocumentBatch(
        roadMapId: string,
        userId: string,
        uploadBatchId: string,
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
            { $pull: { uploadedDocuments: { uploadBatchId: uploadBatchId } } },
            { new: true }
        ).exec();

        if (!result) {
            throw new NotFoundException('Extras not found');
        }

        return { message: 'Document batch deleted successfully' };
    }

    async deleteSingleFileFromBatch(
        roadMapId: string,
        userId: string,
        uploadBatchId: string,
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
            'uploadedDocuments.uploadBatchId': uploadBatchId,
        };

        if (nestedRoadMapItemObjectId) {
            query.nestedRoadMapItemId = nestedRoadMapItemObjectId;
        } else {
            query.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        // First, remove the specific file from the batch
        const result = await this.extrasModel.findOneAndUpdate(
            query,
            {
                $pull: {
                    'uploadedDocuments.$[batch].files': { fileUrl: fileUrl }
                }
            },
            {
                arrayFilters: [{ 'batch.uploadBatchId': uploadBatchId }],
                new: true
            }
        ).exec();

        if (!result) {
            throw new NotFoundException('Document batch not found');
        }

        // If the batch is now empty, remove the entire batch
        const updatedBatch = result.uploadedDocuments.find(
            (doc) => doc.uploadBatchId === uploadBatchId
        );

        if (updatedBatch && updatedBatch.files.length === 0) {
            await this.extrasModel.findOneAndUpdate(
                {
                    roadMapId: roadMapObjectId,
                    userId: userObjectId,
                },
                { $pull: { uploadedDocuments: { uploadBatchId: uploadBatchId } } }
            ).exec();
        }

        return { message: 'File deleted successfully' };
    }

    async findNestedItemById(roadMapId: string, nestedItemId: string): Promise<any> {
        const roadmap = await this.roadMapModel.findById(roadMapId).lean().exec();

        if (!roadmap) {
            throw new NotFoundException(`RoadMap with ID "${roadMapId}" not found`);
        }

        const nestedItem = (roadmap.roadmaps || []).find(
            (item: any) => item._id?.toString() === nestedItemId
        );

        if (!nestedItem) {
            throw new NotFoundException(`Nested roadmap item with ID "${nestedItemId}" not found`);
        }

        return nestedItem;
    }

    async getUserRoadmaps(userId: string) {
        const progress = await this.progressModel
            .findOne({ userId })
            .lean();

        if (!progress) {
            return [];
        }

        const roadmapIds = progress.roadmaps.map(r => r.roadMapId);

        const roadmaps = await this.roadMapModel
            .find({ _id: { $in: roadmapIds } })
            .lean();

        return roadmaps.map(rm => {
            const progressData = progress.roadmaps.find(
                p => p.roadMapId.toString() === rm._id.toString(),
            );

            return {
                ...rm,
                progress: progressData || null,
            };
        });
    }

    async getMentorFromPastor(userId: string) {
        const pastor = await this.userModel.findById(userId).lean();
        if (!pastor) throw new NotFoundException('Pastor not found');

        const mentorId = pastor.assignedId?.[0];
        if (!mentorId) throw new BadRequestException('No mentor assigned');

        const allExtras = await this.extrasModel.find({
            userId: new Types.ObjectId(userId)
        });

        const allSessions = allExtras.flatMap(doc =>
            doc.extras.filter((e: any) => e.type === "APPOINTMENT")
        );

        const sessionNumber = allSessions.length + 1;

        let cumulative = 0;
        let targetPhase: string | null = null;

        for (const phase of SESSION_FLOW) {
            cumulative += phase.totalSessions;

            if (sessionNumber <= cumulative) {
                targetPhase = phase.phaseName;
                break;
            }
        }

        if (!targetPhase) {
            throw new BadRequestException("No phase found for session");
        }

        const roadmap = await this.roadMapModel.findOne({
            name: targetPhase
        }).lean();

        if (!roadmap) {
            throw new NotFoundException("Target roadmap not found");
        }

        const targetRoadMapId = roadmap._id.toString();
        const targetNestedId = roadmap.roadmaps?.[0]?._id?.toString();


        const availability = await this.availabilityModel
            .findOne({ mentorId })
            .lean();

        if (!availability) {
            throw new BadRequestException('No availability found');
        }

        const query: any = {
            userId: new Types.ObjectId(userId),
            roadMapId: new Types.ObjectId(targetRoadMapId),
        };

        if (targetNestedId) {
            query.nestedRoadMapItemId = new Types.ObjectId(targetNestedId);
        } else {
            query.$or = [
                { nestedRoadMapItemId: null },
                { nestedRoadMapItemId: { $exists: false } }
            ];
        }

        let extrasDoc = await this.extrasModel.findOne(query);

        if (!extrasDoc) {
            extrasDoc = await this.extrasModel.create({
                userId: new Types.ObjectId(userId),
                roadMapId: new Types.ObjectId(targetRoadMapId),
                nestedRoadMapItemId: targetNestedId
                    ? new Types.ObjectId(targetNestedId)
                    : null,
                extras: []
            });
        }

        let selectedDay: any = null;
        let selectedSlot: any = null;

        for (const day of availability.weeklySlots) {
            if (day.slots?.length > 0) {
                selectedDay = day;
                selectedSlot = day.slots[0];
                break;
            }
        }

        if (!selectedDay || !selectedSlot) {
            throw new BadRequestException('No available slot found');
        }

        const meetingDate = buildMeetingDate(
            selectedDay.date,
            selectedSlot
        );

        const appointment = await this.appointmentService.create({
            userId: userId.toString(),
            mentorId: mentorId.toString(),
            meetingDate: meetingDate.toISOString(),
            platform: 'zoom',
            notes: "Auto scheduled",
            initiatorRole: 'director'
        });

        await this.extrasModel.updateOne(
            query,
            {
                $set: {
                    "extras.$[elem].data.isRedo": false
                }
            },
            {
                arrayFilters: [{ "elem.type": "APPOINTMENT" }]
            }
        );

        const extraResult = await this.extrasModel.updateOne(
            query,
            {
                $push: {
                    extras: {
                        type: "APPOINTMENT",
                        data: {
                            sessionNumber,
                            title: `Session ${sessionNumber}`,
                            appointmentId: appointment.id,

                            originalDate: meetingDate,
                            scheduledDate: meetingDate,

                            isCompleted: false,
                            isConfirmed: false,
                            isRedo: true,
                            status: "SCHEDULED",

                            mentorNote: SESSION_NOTES[sessionNumber - 1] || "",
                            pastorNote: ""
                        }
                    }
                }
            }
        );

        return {
            mentorId,
            meetingDate,
            appointment,
            extraResult
        };
    }

    async handleSessionCompletion(appointmentId: string) {
        const extrasDoc = await this.extrasModel.findOne({
            $or: [
                { "extras.data.appointmentId": appointmentId },
                { "extras.appointmentId": appointmentId }
            ]
        });

        if (!extrasDoc) return;

        const session = extrasDoc.extras.find(
            (e: any) =>
                e.data?.appointmentId === appointmentId ||
                e.appointmentId === appointmentId
        );

        if (!session.data) {
            session.data = {
                sessionNumber: session.sessionNumber,
                appointmentId: session.appointmentId,
                isCompleted: session.isCompleted,
                isRedo: true,
                status: "SCHEDULED",
                originalDate: new Date(),
                scheduledDate: new Date(),
                mentorNote: "",
                pastorNote: ""
            };
        }

        // mark completed
        session.data.status = "COMPLETED";
        session.data.isCompleted = true;
        session.data.completedAt = new Date();

        // disable redo for ALL old sessions
        extrasDoc.extras.forEach((e: any) => {
            if (e.type === "APPOINTMENT") {
                e.data.isRedo = false;
            }
        });

        await extrasDoc.save();

        // CREATE NEXT SESSION
        await this.getMentorFromPastor(
            extrasDoc.userId.toString()
        );
    }

    async redoSession(appointmentId: string) {

        const extrasDoc = await this.extrasModel.findOne({
            "extras.data.appointmentId": appointmentId
        });

        if (!extrasDoc) {
            throw new NotFoundException('Session not found');
        }

        const session = extrasDoc.extras.find(
            (e: any) => e.data?.appointmentId === appointmentId
        );

        if (!session) {
            throw new NotFoundException('Session not found');
        }

        if (!session.data.isRedo) {
            throw new BadRequestException('Redo not allowed');
        }

        // get mentor
        const pastor = await this.userModel.findById(extrasDoc.userId).lean();
        const mentorId = pastor?.assignedId?.[0];

        if (!mentorId) {
            throw new BadRequestException('No mentor assigned');
        }

        // get availability
        const availability = await this.availabilityModel
            .findOne({ mentorId })
            .lean();

        if (!availability) {
            throw new BadRequestException('No availability');
        }

        // pick slot
        let selectedDay: any = null;
        let selectedSlot: any = null;

        for (const day of availability.weeklySlots) {
            if (day.slots?.length > 0) {
                selectedDay = day;
                selectedSlot = day.slots[0];
                break;
            }
        }

        if (!selectedDay || !selectedSlot) {
            throw new BadRequestException('No slot found');
        }

        const meetingDate = buildMeetingDate(
            selectedDay.date,
            selectedSlot
        );

        // create new appointment
        const appointment = await this.appointmentService.create({
            userId: extrasDoc.userId.toString(),
            mentorId: mentorId.toString(),
            meetingDate: meetingDate.toISOString(),
            platform: 'zoom',
            notes: "Redo session",
            initiatorRole: 'director'
        });

        // update SAME session (not push)
        session.data.appointmentId = appointment.id;
        session.data.scheduledDate = meetingDate;
        session.data.status = "SCHEDULED";
        session.data.isCompleted = false;
        session.data.completedAt = null;

        await extrasDoc.save();

        return {
            message: "Redo successful",
            sessionNumber: session.data.sessionNumber,
            appointment
        };
    }

    async getUserSessions(userId: string) {

        const extras = await this.extrasModel
            .find({ userId: new Types.ObjectId(userId) })
            .lean();

        const sessions = extras.flatMap(doc =>
            doc.extras
                .filter((e: any) => e.type === "APPOINTMENT")
                .map((e: any) => ({
                    sessionNumber: e.data.sessionNumber,
                    title: e.data.title,
                    status: e.data.status,
                    scheduledDate: e.data.scheduledDate,
                    mentorNote: e.data.mentorNote,
                    pastorNote: e.data.pastorNote,
                    appointmentId: e.data.appointmentId
                }))
        );

        return sessions.sort((a, b) => a.sessionNumber - b.sessionNumber);
    }
}