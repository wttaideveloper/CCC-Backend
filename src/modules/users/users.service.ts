import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Interest, InterestDocument } from '../interests/schemas/interest.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { hashPassword } from '../../common/utils/bcrypt.util';
import { toUserResponseDto } from './utils/user.mapper';
import { AssignMentorMenteeDto, RemoveMentorMenteeDto, UserResponseDto } from './dto/user-response.dto';
import { S3Service } from '../s3/s3.service';
import { UserDocumentResponseDto } from './dto/upload-document.dto';
import {
    InviteFieldMentorDto,
    AcceptInvitationDto,
    MarkCompletedDto,
    IssueCertificateDto,
} from './dto/user-operations.dto';
import { ROLES } from '../../common/constants/roles.constants';
import { nanoid } from 'nanoid';
import { HomeService } from '../home/home.service';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Interest.name) private interestModel: Model<InterestDocument>,
        private readonly s3Service: S3Service,
        private readonly notificationService: HomeService,
    ) { }

    async create(dto: CreateUserDto): Promise<UserResponseDto> {
        const existing = await this.userModel.findOne({ email: dto.email });
        if (existing) throw new BadRequestException('Email already registered');

        const hashedPassword = dto.password
            ? await hashPassword(dto.password)
            : undefined;

        const user = new this.userModel({
            ...dto,
            password: hashedPassword,
        });

        const savedUser = await user.save();
        return toUserResponseDto(savedUser);
    }

    async findAll(filters?: {
        role?: string;
        status?: string;
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{ users: UserResponseDto[]; total: number; page: number; totalPages: number }> {

        const query: any = {};

        if (filters?.role) {
            if (filters.role === 'mentor') {
                query.role = { $in: ['mentor', 'field mentor'] };
            }
            else if(filters.role === 'pastor') {
                query.role = { $in: ['pastor', 'lay leader', 'seminarian'] };
            }
            else {
                query.role = filters.role;
            }
        }

        if (filters?.status) {
            query.status = filters.status;
        }

        if (filters?.search) {
            query.$or = [
                { firstName: { $regex: filters.search, $options: 'i' } },
                { lastName: { $regex: filters.search, $options: 'i' } },
                { email: { $regex: filters.search, $options: 'i' } },
                { username: { $regex: filters.search, $options: 'i' } },
            ];
        }

        const page = filters?.page && filters.page > 0 ? filters.page : 1;
        const limit = filters?.limit && filters.limit > 0 ? filters.limit : 10;
        const skip = (page - 1) * limit;

        const [usersRaw, total] = await Promise.all([
            this.userModel
                .find(query)
                .select('-password -refreshToken -uploadedDocuments')
                .populate({
                    path: 'interestId',
                    select: 'profileInfo',
                })
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .lean()
                .exec(),

            this.userModel.countDocuments(query).exec(),
        ]);

        const users = usersRaw.map((user: any) => {
            const dto = toUserResponseDto(user);

            return {
                ...dto,
                profileInfo: user.interestId?.profileInfo ?? null,
            };
        });

        return {
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(id: string): Promise<any> {
        const user = await this.userModel
            .findById(id)
            .select('-password -refreshToken -uploadedDocuments')
            .lean();

        if (!user) throw new NotFoundException('User not found');

        const interest = await this.interestModel
            .findOne({ userId: id })
            .lean();

        return {
            ...toUserResponseDto(user),
            interest: interest || null,
        };
    }

    async findByEmail(email: string): Promise<UserDocument> {
        const user = await this.userModel.findOne({ email }).exec();
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async findByRole(role: string): Promise<UserResponseDto[]> {
        const users = await this.userModel.find({ role }).select('-password -refreshToken -uploadedDocuments').lean().exec();
        if (!users || users.length === 0)
            throw new NotFoundException('User not found');
        return users.map((user) => toUserResponseDto(user));
    }

    async update(
        id: string,
        updateData: UpdateUserDto,
    ): Promise<UserResponseDto> {
        const dataToUpdate: any = { ...updateData };
        if (updateData.password) {
            dataToUpdate.password = await hashPassword(updateData.password);
        }

        const updated = await this.userModel
            .findByIdAndUpdate(id, dataToUpdate, { new: true, runValidators: true })
            .select('-password -refreshToken -uploadedDocuments')
            .exec();
        if (!updated) throw new NotFoundException('User not found');
        return toUserResponseDto(updated);
    }

    async delete(id: string): Promise<void> {
        const result = await this.userModel.findByIdAndDelete(id).exec();
        if (!result) throw new NotFoundException('User not found');
    }

    async saveRefreshToken(userId: string, token: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, { refreshToken: token });
    }

    async clearRefreshToken(userId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, { refreshToken: null });
    }

    async checkUserStatus(userId: string): Promise<string> {
        const user = await this.userModel.findById(userId).select('status').lean().exec();
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user.status;
    }

    async assignUsers(userId: string, dto: AssignMentorMenteeDto) {
        const assigningUser = await this.userModel.findById(userId)
            .select('_id firstName lastName');

        if (!assigningUser) throw new NotFoundException('User not found');

        const targetUsers = await this.userModel.find({
            _id: { $in: dto.assignedId }
        }).select('_id firstName lastName').lean();

        if (targetUsers.length !== dto.assignedId.length) {
            throw new NotFoundException('One or more users not found');
        }

        const targetIds = targetUsers.map(u => u._id);

        await this.userModel.findByIdAndUpdate(
            userId,
            { $addToSet: { assignedId: { $each: targetIds } } },
            { new: true }
        );

        await this.userModel.updateMany(
            { _id: { $in: targetIds } },
            { $addToSet: { assignedId: assigningUser._id } }
        );

        for (const target of targetUsers) {
            await this.notificationService.addNotification({
                userId: target._id.toString(),
                name: "Assigned",
                details: `You have been assigned to ${assigningUser.firstName} ${assigningUser.lastName}.`,
                module: "assignment",
            });
        }

        const assignedNames = targetUsers
            .map(u => `${u.firstName} ${u.lastName}`)
            .join(', ');

        await this.notificationService.addNotification({
            userId,
            name: "Assignment Completed",
            details: `You assigned: ${assignedNames}.`,
            module: "assignment",
        });

        return this.userModel.findById(userId).populate('assignedId');
    }

    async removeUsers(userId: string, dto: RemoveMentorMenteeDto) {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        const targetUsers = await this.userModel.find({
            _id: { $in: dto.assignedId }
        }).select('_id').lean();

        if (targetUsers.length !== dto.assignedId.length) {
            throw new NotFoundException('One or more users not found');
        }

        const targetIds = targetUsers.map(u => u._id);

        await this.userModel.findByIdAndUpdate(
            userId,
            { $pull: { assignedId: { $in: targetIds } } },
            { new: true }
        );

        await this.userModel.updateMany(
            { _id: { $in: targetIds } },
            { $pull: { assignedId: user._id } }
        );

        return this.userModel.findById(userId).populate('assignedId');
    }

    async getAssignedUsers(userId: string) {
        const user = await this.userModel
            .findById(userId)
            .select('assignedId')
            .populate('assignedId', 'firstName lastName email role status profilePicture')
            .lean();

        if (!user) throw new NotFoundException('User not found');

        const assigned = user.assignedId || [];

        if (assigned.length === 0) return [];

        const assignedUserIds = assigned.map((u: any) => (u._id ? u._id.toString() : u.toString()));

        const interests = await this.interestModel
            .find({ userId: { $in: assignedUserIds } })
            .select('userId profileInfo')
            .lean();

        const interestMap = new Map<string, string | undefined>();
        for (const it of interests) {
            const key = (it.userId as any).toString();
            interestMap.set(key, (it as any).profileInfo);
        }

        const result = assigned.map((u: any) => ({
            ...u,
            profileInfo: interestMap.get(u._id.toString()) ?? null,
        }));

        return result;
    }

    async updateProfilePicture(
        userId: string,
        file: Express.Multer.File,
    ): Promise<UserResponseDto> {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException('Invalid file type. Only JPEG, PNG, and WebP are allowed');
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new BadRequestException('File size exceeds 5MB limit');
        }

        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const timestamp = Date.now();
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `profile-pictures/${userId}_${timestamp}.${fileExtension}`;

        const fileUrl = await this.s3Service.uploadFile(
            fileName,
            file.buffer,
            file.mimetype,
        );

        const updated = await this.userModel
            .findByIdAndUpdate(
                userId,
                { profilePicture: fileUrl },
                { new: true, runValidators: true }
            )
            .select('-password -refreshToken -uploadedDocuments')
            .exec();

        if (!updated) {
            throw new NotFoundException('User not found');
        }

        return toUserResponseDto(updated);
    }

    async uploadDocument(
        userId: string,
        file: Express.Multer.File,
    ): Promise<UserDocumentResponseDto> {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        const allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.ms-excel', // .xls
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException(
                'Invalid file type. Only PDF, images, Word, and Excel documents are allowed'
            );
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            throw new BadRequestException('File size exceeds 10MB limit');
        }

        const user = await this.userModel.findById(userId).select('_id').lean();
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const timestamp = Date.now();
        const fileExtension = file.originalname.split('.').pop();
        const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `user-documents/${userId}/${timestamp}_${sanitizedFileName}`;

        const fileUrl = await this.s3Service.uploadFile(
            fileName,
            file.buffer,
            file.mimetype,
        );

        const documentData: UserDocumentResponseDto = {
            fileName: file.originalname,
            fileUrl,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadedAt: new Date(),
        };

        await this.userModel.findByIdAndUpdate(
            userId,
            { $push: { uploadedDocuments: documentData } },
            { new: true }
        );

        return documentData;
    }

    async getDocuments(userId: string): Promise<UserDocumentResponseDto[]> {
        const user = await this.userModel
            .findById(userId)
            .select('uploadedDocuments')
            .lean()
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user.uploadedDocuments || [];
    }

    async deleteDocument(userId: string, documentUrl: string): Promise<void> {
        const user = await this.userModel.findById(userId).select('uploadedDocuments');
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const documentExists = user.uploadedDocuments?.some(
            doc => doc.fileUrl === documentUrl
        );

        if (!documentExists) {
            throw new NotFoundException('Document not found');
        }

        await this.userModel.findByIdAndUpdate(
            userId,
            { $pull: { uploadedDocuments: { fileUrl: documentUrl } } },
            { new: true }
        );
    }

    async inviteFieldMentor(dto: InviteFieldMentorDto): Promise<{ token: string; expiresAt: Date }> {
        const user = await this.userModel.findOne({
            email: dto.email,
            $or: [
                { fieldMentorInvitation: { $exists: false } },
                { 'fieldMentorInvitation.expiresAt': { $lte: new Date() } }
            ]
        }).select('_id').lean();

        if (!user) {
            const existingUser = await this.userModel.findOne({ email: dto.email }).select('fieldMentorInvitation').lean();
            if (!existingUser) {
                throw new NotFoundException('User not found with this email');
            }
            throw new ConflictException('User already has a pending invitation');
        }

        const token = nanoid(32);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        await this.userModel.findByIdAndUpdate(user._id, {
            fieldMentorInvitation: {
                invitedBy: dto.invitedBy,
                invitedAt: new Date(),
                token,
                expiresAt,
            },
        });

        return { token, expiresAt };
    }

    async acceptInvitation(dto: AcceptInvitationDto): Promise<UserResponseDto> {
        const user = await this.userModel.findOne({
            'fieldMentorInvitation.token': dto.token,
        });

        if (!user) {
            throw new NotFoundException('Invalid invitation token');
        }

        if (!user.fieldMentorInvitation || user.fieldMentorInvitation.expiresAt < new Date()) {
            throw new BadRequestException('Invitation has expired');
        }

        const updatedUser = await this.userModel.findByIdAndUpdate(
            user._id,
            {
                role: ROLES.FIELD_MENTOR,
                $unset: { fieldMentorInvitation: 1 },
            },
            { new: true }
        );

        if (!updatedUser) {
            throw new NotFoundException('User not found');
        }

        return toUserResponseDto(updatedUser);
    }

    async markCompleted(dto: MarkCompletedDto): Promise<UserResponseDto> {
        const user = await this.userModel.findByIdAndUpdate(
            dto.userId,
            { hasCompleted: true },
            { new: true }
        );

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return toUserResponseDto(user);
    }

    async issueCertificate(dto: IssueCertificateDto): Promise<UserResponseDto> {
        const updatedUser = await this.userModel.findOneAndUpdate(
            {
                _id: dto.userId,
                hasCompleted: true,
                hasIssuedCertificate: { $ne: true },
            },
            { hasIssuedCertificate: true },
            { new: true }
        );

        if (!updatedUser) {
            const user = await this.userModel.findById(dto.userId).select('hasCompleted hasIssuedCertificate').lean();

            if (!user) {
                throw new NotFoundException('User not found');
            }
            if (!user.hasCompleted) {
                throw new BadRequestException('User has not completed their progress');
            }
            if (user.hasIssuedCertificate) {
                throw new ConflictException('Certificate already issued to this user');
            }
        }

        return toUserResponseDto(updatedUser);
    }
}
