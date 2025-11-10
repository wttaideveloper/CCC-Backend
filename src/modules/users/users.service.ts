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
import { AssignMentorDto, UserResponseDto } from './dto/user-response.dto';

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

    async assignMentor(userId: string, dto: AssignMentorDto) {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        const mentor = await this.userModel.findById(dto.mentorId);
        if (!mentor) throw new NotFoundException('Mentor not found');

        const alreadyAssigned = user.assignedMentor.some(
            (m) => m.toString() === dto.mentorId,
        );
        if (alreadyAssigned) return user;

        user.assignedMentor.push(new Types.ObjectId(dto.mentorId));
        await user.save();

        return user;
    }

    async getMentorList(userId: string) {
        const user = await this.userModel
            .findById(userId)
            .populate('assignedMentor', 'name email role');
        if (!user) throw new NotFoundException('User not found');

        return user.assignedMentor;
    }
}
