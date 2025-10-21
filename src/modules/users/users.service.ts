import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { hashPassword } from '../../common/utils/bcrypt.util';
import { toUserResponseDto } from './utils/user.mapper';
import { UserResponseDto } from './dto/user-response.dto';

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
            : null;

    const user = new this.userModel({
      ...dto,
      password: hashedPassword,
    });

    const savedUser = await user.save();
    return toUserResponseDto(savedUser);
  }

    async findAll(): Promise<UserResponseDto[]> {
        const users = await this.userModel.find().select('-password').exec();
        return users.map((user) => toUserResponseDto(user));
    }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) throw new NotFoundException('User not found');
    return toUserResponseDto(user);
  }

  async findByEmail(email: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

    async findByRole(role: string): Promise<UserResponseDto[]> {
        const users = await this.userModel.find({ role }).exec();
        if (!users || users.length === 0)
            throw new NotFoundException('User not found');
        return users.map((user) => toUserResponseDto(user));
    }

    async update(
        id: string,
        updateData: Partial<User>,
    ): Promise<UserResponseDto> {
        const updated = await this.userModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .select('-password')
            .exec();
        if (!updated) throw new NotFoundException('User not found');
        return toUserResponseDto(updated);
    }

  async delete(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('User not found');
  }

    async updatePassword(
        email: string,
        password: string,
    ): Promise<UserResponseDto> {
        const hashed = await hashPassword(password);
        const user = await this.userModel
            .findOneAndUpdate({ email }, { password: hashed }, { new: true })
            .select('-password')
            .exec();

    if (!user) throw new NotFoundException('User not found');
    return toUserResponseDto(user);
  }

  async saveRefreshToken(userId: string, token: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: token });
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: null });
  }

    async checkUserStatus(userId: string): Promise<string> {
        const user = await this.userModel.findById(userId).select('status');
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user.status;
    }
}
