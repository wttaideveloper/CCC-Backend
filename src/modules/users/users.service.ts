import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { hashPassword } from '../../common/utils/bcrypt.util';
import { toUserResponseDto } from './utils/user.mapper';
import { AssignMentorMenteeDto, RemoveMentorMenteeDto, UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
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

    async findAll(filters?: { role?: string; status?: string }): Promise<UserResponseDto[]> {
        const query: any = {};
        if (filters?.role) {
            query.role = filters.role;
        }
        if (filters?.status) {
            query.status = filters.status;
        }

        const users = await this.userModel.find(query).select('-password -refreshToken').lean().exec();
        return users.map((user) => toUserResponseDto(user));
    }

    async findById(id: string): Promise<UserResponseDto> {
        const user = await this.userModel.findById(id).select('-password -refreshToken').lean().exec();
        if (!user) throw new NotFoundException('User not found');
        return toUserResponseDto(user);
    }

    async findByEmail(email: string): Promise<UserDocument> {
        const user = await this.userModel.findOne({ email }).exec();
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async findByRole(role: string): Promise<UserResponseDto[]> {
        const users = await this.userModel.find({ role }).select('-password -refreshToken').lean().exec();
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
            .select('-password -refreshToken')
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
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        for (const targetId of dto.assignedId) {
            const targetUser = await this.userModel.findById(targetId);
            if (!targetUser) throw new NotFoundException(`User not found`);

            await this.userModel.findByIdAndUpdate(
                userId,
                { $addToSet: { assignedId: targetUser._id } },
                { new: true }
            );

            await this.userModel.findByIdAndUpdate(
                targetId,
                { $addToSet: { assignedId: user._id } },
                { new: true }
            );
        }

        return this.userModel.findById(userId).populate('assignedId');
    }

    async removeUsers(userId: string, dto: RemoveMentorMenteeDto) {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        for (const targetId of dto.assignedId) {
            const targetUser = await this.userModel.findById(targetId);
            if (!targetUser) throw new NotFoundException(`User not found`);

            await this.userModel.findByIdAndUpdate(
                userId,
                { $pull: { assignedId: targetUser._id } },
                { new: true }
            );

            await this.userModel.findByIdAndUpdate(
                targetId,
                { $pull: { assignedId: user._id } },
                { new: true }
            );
        }

        return this.userModel.findById(userId).populate('assignedId');
    }

    async getAssignedUsers(userId: string) {
        const user = await this.userModel
            .findById(userId)
            .populate('assignedId', 'firstName lastName email role status profilePicture assignedId')
            .lean();

        if (!user) throw new NotFoundException('User not found');
        return user.assignedId || [];
    }
}
