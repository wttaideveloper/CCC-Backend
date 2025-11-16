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
import { VALID_USER_APPLICATION_STATUSES, USER_APPLICATION_STATUSES, VALID_USER_STATUSES, USER_STATUSES } from '../../common/constants/status.constants';
import { UsersService } from '../users/users.service';
import { ROLES } from '../../common/constants/roles.constants';

@Injectable()
export class InterestService {
  constructor(
    @InjectModel(Interest.name)
    private readonly interestModel: Model<InterestDocument>,
    private readonly usersService: UsersService,
  ) { }

  async create(dto: CreateInterestDto): Promise<InterestResponseDto> {
    try {
      const interest = await this.interestModel.create(dto);
      console.log(`Interest form created successfully for email: ${dto.email}, interestId: ${interest._id}`);

      return toInterestResponseDto(interest);
    } catch (error: any) {
      if (error.code === 11000 && error.keyPattern?.email) {
        throw new BadRequestException('An interest form with this email already exists');
      }
      throw error;
    }
  }

  async findAll(filters?: { search?: string; status?: string }) {
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'users',
          localField: 'email', // join via email (since interestId may be missing)
          foreignField: 'email',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true, // keep interests even if user not found
        },
      },
    ];

    const match: any = {};

    // 🔍 Search by Interest fields (and optionally user email)
    if (filters?.search) {
      const regex = new RegExp(filters.search, 'i');
      match.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phoneNumber: regex },
        { 'user.email': regex },
      ];
    }

    // 🎯 Filter by User's status if provided
    if (filters?.status) {
      match['user.status'] = filters.status;
    }

    // Add filters to pipeline if they exist
    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    // Sort by newest
    pipeline.push({ $sort: { createdAt: -1 } });

    // Only project Interest fields (no user info)
    pipeline.push({
      $project: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        phoneNumber: 1,
        churchDetails: 1,
        title: 1,
        conference: 1,
        yearsInMinistry: 1,
        currentCommunityProjects: 1,
        interests: 1,
        comments: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    const results = await this.interestModel.aggregate(pipeline).exec();
    return results;
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
    const interest = await this.interestModel.findOne({ email }).lean().exec();
    if (!interest) throw new NotFoundException('Interest form not found');
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

    if (!updatedInterest) throw new NotFoundException('Interest form not found');
    return toInterestResponseDto(updatedInterest);
  }

  async getInterestsByStatus(status: string, limit?: number) {
    if (!VALID_USER_APPLICATION_STATUSES.includes(status as any)) {
      throw new BadRequestException('Invalid status value');
    }

    const matchCondition: any = {};

    if (status === USER_APPLICATION_STATUSES.NEW) {
      matchCondition.userDetails = { $eq: null };
    } else {
      matchCondition['userDetails.status'] = status;
    }

    const pipeline: any[] = [
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
          profileInfo: 1,
          title: 1,
          createdAt: 1,
          updatedAt: 1,
          churchDetails: 1,
          interests: 1,
          'userDetails._id': 1,
          'userDetails.role': 1,
          'userDetails.roleId': 1,
          'userDetails.profilePicture': 1,
          'userDetails.isEmailVerified': 1,
          'userDetails.status': 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    if (limit && limit > 0) {
      const safeLimit = Math.min(limit, 100);
      pipeline.push({ $limit: safeLimit });
    }

    return this.interestModel.aggregate(pipeline).exec();
  }

  async updateUserStatus(
    interestId: string,
    status: string,
  ) {
    if (!VALID_USER_STATUSES.includes(status as any)) {
      throw new BadRequestException('Invalid status value. Allowed values: pending, accepted, rejected');
    }

    const interest = await this.interestModel.findById(interestId).lean().exec();
    if (!interest) {
      throw new NotFoundException('Interest form not found');
    }

    let userId: string;

    if (interest.userId) {
      try {
        const existingUser = await this.usersService.findById(interest.userId.toString());
        userId = existingUser.id;

        const updateData: any = { status };
        if (status === USER_STATUSES.ACCEPTED) {
          updateData.role = ROLES.PASTOR;
        }
        await this.usersService.update(userId, updateData);
        console.log(`Updated existing user ${userId} with status: ${status}`);

        return this.usersService.findById(userId);
      } catch (error) {
        console.warn(`User ${interest.userId} not found, creating new user for interest ${interestId}`);
      }
    }

    const newUser = await this.usersService.create({
      firstName: interest.firstName,
      lastName: interest.lastName,
      email: interest.email,
      interestId: interest._id,
      profilePicture: interest.profilePicture,
      status,
      role: status === USER_STATUSES.ACCEPTED ? ROLES.PASTOR : ROLES.PENDING,
    });

    userId = newUser.id;
    console.log(`Created new user ${userId} from interest form: ${interestId}`);

    await this.interestModel.findByIdAndUpdate(
      interestId,
      { userId },
      { new: true }
    ).lean().exec();
    console.log(`Linked interest ${interestId} with user: ${userId}`);

    return this.usersService.findById(userId);
  }

  async findById(id: string): Promise<InterestResponseDto> {
    const interest = await this.interestModel.findById(id).lean().exec();
    if (!interest) throw new NotFoundException('Interest form not found');
    return toInterestResponseDto(interest);
  }
}
