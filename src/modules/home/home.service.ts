import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Home, HomeDocument } from './schemas/home.schema';
import { HomeResponseDto } from './dto/home-response.dto';
import { MentorResponseDto } from './dto/mentor-response.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  toHomeResponseDto,
  toMentorMenteeDetailsDto,
} from './utils/home.mapper';
import { MentorMenteeDetailsDto } from './dto/mentor.mentee.response.dto';
import {
  Notification,
  NotificationDocument,
  NotificationItem,
} from './schemas/notification.schema';
import {
  AddNotificationDto,
  NotificationResponseDto,
} from './dto/notification.dto';
import { USER_ROLES } from '../../common/constants/status.constants';

interface MentorFilterOptions {
  page?: number;
  limit?: number;
  country?: string;
  state?: string;
  conference?: string;
  role?: string;
}

@Injectable()
export class HomeService {
  constructor(
    @InjectModel(Home.name)
    private readonly homeModel: Model<HomeDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) { }

  async getByEmail(email: string): Promise<HomeResponseDto> {
    const home = await this.homeModel.findOne({ email }).lean().exec();

    if (!home) {
      throw new NotFoundException(`Home data not found for email: ${email}`);
    }
    return toHomeResponseDto(home as any);
  }

  async getMentorByEmail(email: string): Promise<MentorMenteeDetailsDto> {
    const user = await this.userModel
      .findOne({ email, role: USER_ROLES.MENTOR })
      .populate('interestId')
      .exec();

    if (!user) throw new NotFoundException('Mentor not found');

    return toMentorMenteeDetailsDto(user);
  }

  async getMenteeByEmail(email: string): Promise<MentorMenteeDetailsDto> {
    const user = await this.userModel
      .findOne({ email, role: USER_ROLES.PASTOR })
      .populate('interestId')
      .exec();

    if (!user) throw new NotFoundException('Mentee not found');

    return toMentorMenteeDetailsDto(user);
  }

  async getAllMentors(
    options: MentorFilterOptions = {},
  ): Promise<{ mentors: MentorResponseDto[]; total: number }> {
    const { page = 1, limit = 10, country, state, conference, role } = options;
    const skip = (page - 1) * limit;

    const roleFilter = role
      ? Array.isArray(role)
        ? { $in: role }
        : role
      : { $in: [USER_ROLES.MENTOR, 'field mentor'] };

    const pipeline: any[] = [
      {
        $match: {
          role: roleFilter,
        },
      },

      {
        $lookup: {
          from: 'interests',
          localField: '_id',
          foreignField: 'userId',
          as: 'interestData',
        },
      },
    ];

    if (country || state || conference) {
      const matchConditions: any = {};

      if (country) {
        matchConditions['interestData.churchDetails.country'] = country;
      }
      if (state) {
        matchConditions['interestData.churchDetails.state'] = state;
      }
      if (conference) {
        matchConditions['interestData.conference'] = conference;
      }

      pipeline.push({
        $match: matchConditions,
      });
    }

    pipeline.push({
      $project: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        username: 1,
        role: 1,
        profilePicture: 1,
      },
    });

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    });

    const result = await this.userModel.aggregate(pipeline).exec();

    const total = result[0]?.metadata[0]?.total || 0;
    const mentorsData = result[0]?.data || [];

    const mentors: MentorResponseDto[] = mentorsData.map((mentor) => {
      const dto = new MentorResponseDto();
      dto.id = mentor._id.toString();
      dto.firstName = mentor.firstName;
      dto.lastName = mentor.lastName;
      dto.email = mentor.email;
      dto.username = mentor.username || '';
      dto.role = mentor.role;
      return dto;
    });

    return { mentors, total };
  }

  async getAllMentees(
    options: {
      page?: number;
      limit?: number;
      phase?: string;
      country?: string;
    } = {},
  ): Promise<{ mentees: MentorResponseDto[]; total: number }> {
    const { page = 1, limit = 10, phase, country } = options;
    const skip = (page - 1) * limit;

    const pipeline: any[] = [
      {
        $match: {
          role: USER_ROLES.PASTOR,
        },
      },

      {
        $lookup: {
          from: 'interests',
          localField: '_id',
          foreignField: 'userId',
          as: 'interestData',
        },
      },
    ];

    if (country || phase) {
      const matchConditions: any = {};

      if (country) {
        matchConditions['interestData.churchDetails.country'] = country;
      }
      if (phase) {
        matchConditions['interestData.churchDetails.state'] = phase;
      }

      pipeline.push({
        $match: matchConditions,
      });
    }

    pipeline.push({
      $project: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        username: 1,
        role: 1,
        profilePicture: 1,
      },
    });

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    });

    const result = await this.userModel.aggregate(pipeline).exec();

    const total = result[0]?.metadata[0]?.total || 0;
    const menteesData = result[0]?.data || [];

    const mentees: MentorResponseDto[] = menteesData.map((mentee) => {
      const dto = new MentorResponseDto();
      dto.id = mentee._id.toString();
      dto.firstName = mentee.firstName;
      dto.lastName = mentee.lastName;
      dto.email = mentee.email;
      dto.username = mentee.username || '';
      dto.role = mentee.role;
      return dto;
    });

    return { mentees, total };
  }

  async addNotification(
    dto: AddNotificationDto,
  ): Promise<NotificationResponseDto> {
    const { email, name, details, module, roleId } = dto;

    let notificationDoc = await this.notificationModel.findOne({ email });

    const newItem: NotificationItem = {
      name,
      details,
      module,
      read: false,
    };

    if (notificationDoc) {
      notificationDoc.notifications.push(newItem);
      if (roleId) notificationDoc.roleId = roleId;
      await notificationDoc.save();
    } else {
      notificationDoc = await this.notificationModel.create({
        email,
        roleId,
        notifications: [newItem],
      });
    }

    return this.mapToResponse(notificationDoc);
  }

  async getNotifications(email: string): Promise<NotificationResponseDto> {
    const notificationDoc = await this.notificationModel.findOne({ email }).lean().exec();
    if (!notificationDoc) {
      throw new NotFoundException('No notifications found for this user');
    }
    return this.mapToResponse(notificationDoc as any);
  }

  async deleteNotification(
    email: string,
    notificationId: string,
  ): Promise<NotificationResponseDto> {
    const doc = await this.notificationModel.findOne({ email });
    if (!doc) throw new NotFoundException('Notification document not found');

    const target = doc.notifications.find(
      (item: any) => item._id.toString() === notificationId,
    );

    if (!target) {
      throw new Error('Notification not found');
    }

    target.read = true;
    await doc.save();

    return this.mapToResponse(doc);
  }

  private mapToResponse(doc: NotificationDocument | any): NotificationResponseDto {
    return {
      _id: doc._id?.toString() || String(doc._id),
      email: doc.email,
      roleId: doc.roleId,
      notifications: doc.notifications?.map((n: any) => ({
        name: n.name,
        details: n.details,
        module: n.module,
      })) || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
