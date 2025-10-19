import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Interest, InterestDocument } from './schemas/interest.schema';
import {
  CreateInterestDto,
  UpdateInterestDto,
} from './dto/create-interest.dto';
import { InterestResponseDto } from './dto/interest-response.dto';
import { toInterestResponseDto } from './utils/interest.mapper';
import {
  COUNTRIES_STATES_LIST,
  INTERESTS_LIST,
  TITLES_LIST,
} from 'src/shared/constants/metadata.constants';
import { InterestMetadataDto } from './dto/interestMetadata.dto';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class InterestService {
  constructor(
    @InjectModel(Interest.name)
    private readonly interestModel: Model<InterestDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateInterestDto): Promise<InterestResponseDto> {
    const interest = await this.interestModel.create(dto);
    return toInterestResponseDto(interest);
  }

  async findAll(): Promise<InterestResponseDto[]> {
    const interests = await this.interestModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
    return interests.map(toInterestResponseDto);
  }

  async getMetadata(): Promise<InterestMetadataDto> {
    const countriesList = COUNTRIES_STATES_LIST.map((item) => item.country);
    return {
      titles: TITLES_LIST,
      countries: countriesList,
      countryStates: COUNTRIES_STATES_LIST,
      interests: INTERESTS_LIST,
    };
  }

  async findByEmail(email: string): Promise<InterestResponseDto> {
    const interest = await this.interestModel.findOne({ email }).exec();
    if (!interest) throw new Error('Interest form not found');
    return toInterestResponseDto(interest);
  }

  async update(
    email: string,
    dto: UpdateInterestDto,
  ): Promise<InterestResponseDto> {
    const updatedInterest = await this.interestModel
      .findOneAndUpdate(
        { email },
        { $set: dto },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedInterest) throw new Error('Interest form not found');
    return toInterestResponseDto(updatedInterest);
  }

  async getInterestsByStatus(status: string, limit = 10) {
    const validStatuses = ['new', 'pending', 'accepted'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid status value');
    }

    const matchCondition: any = {};

    if (status === 'new') {
      matchCondition.userDetails = { $eq: null };
    } else {
      matchCondition['userDetails.status'] = status;
    }

    return this.interestModel
      .aggregate([
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: 'interestId',
            as: 'userDetails',
          },
        },
        { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
        { $match: matchCondition },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            phoneNumber: 1,
            profilePicture: 1,
            createdAt: 1,
            churchDetails: 1,
            'userDetails._id': 1,
            'userDetails.role': 1,
            'userDetails.roleId': 1,
            'userDetails.profilePicture': 1,
            'userDetails.isEmailVerified': 1,
            'userDetails.status': 1,
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: limit },
      ])
      .exec();
  }

  async updateUserStatus(
    userId: string,
    status: 'pending' | 'accepted' | 'rejected',
  ) {
    const validStatuses = ['pending', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid status value');
    }

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.status = status;
    return user.save();
  }
}
