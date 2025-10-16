import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Home, HomeDocument } from './schemas/home.schema';
import { HomeResponseDto } from './dto/home-response.dto';
import { MentorResponseDto } from './dto/mentor-response.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
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
    private readonly userService: UsersService,
  ) {}

  async getByEmail(email: string): Promise<HomeResponseDto> {
    const home = await this.homeModel.findOne({ email }).exec();

    if (!home) {
      throw new NotFoundException(`Home data not found for email: ${email}`);
    }
    return toHomeResponseDto(home);
  }

  // async getMentors(): Promise<MentorDto> {
  //     const mentors = await this.userService.findByRole('mentor');

  //     if (!mentors) throw new NotFoundException(`Mentors data not found`);

  //     return mentors.map(mentor => toMentorResponseDto(mentor))
  // }

  // async getVideos(email: string): Promise<HomeVideoDto> {

  // }

  async getMentorByEmail(email: string): Promise<MentorMenteeDetailsDto> {
    const user = await this.userModel
      .findOne({ email, role: 'mentor' })
      .populate('interestId')
      .exec();

    if (!user) throw new NotFoundException('Mentor not found');

    return toMentorMenteeDetailsDto(user);
  }

  async getMenteeByEmail(email: string): Promise<MentorMenteeDetailsDto> {
    const user = await this.userModel
      .findOne({ email, role: 'pastor' })
      .populate('interestId')
      .exec();

    if (!user) throw new NotFoundException('Mentee not found');

    return toMentorMenteeDetailsDto(user);
  }

  async getAllMentors(
    options: MentorFilterOptions = {},
  ): Promise<{ mentors: MentorResponseDto[]; total: number }> {
    const { page = 1, limit = 10, country, state, conference, role } = options;

    const roleFilter: any = role || { $in: ['mentor', 'field mentor'] };

    const allMentors = await this.userService.findByRole(roleFilter);

    let filteredMentors = allMentors;

    if (country || state || conference) {
      filteredMentors = allMentors.filter((mentor: any) => {
        const interests = mentor.interests || [];
        return interests.some((interest: any) => {
          const church = interest.churchDetails?.[0] || {};
          return (
            (!country || church.country === country) &&
            (!state || church.state === state) &&
            (!conference || interest.conference === conference)
          );
        });
      });
    }

    const mentorDtos: MentorResponseDto[] = filteredMentors.map((mentor) => {
      const dto = new MentorResponseDto();
      dto.id = mentor.id;
      dto.firstName = mentor.firstName;
      dto.lastName = mentor.lastName;
      dto.email = mentor.email;
      dto.username = mentor.username || '';
      dto.role = mentor.role;
      // dto.profileInfo = mentor.profileInfo || '';
      return dto;
    });

    const total = mentorDtos.length;
    const paginated = mentorDtos.slice((page - 1) * limit, page * limit);

    return { mentors: paginated, total };
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

    const allMentees = await this.userService.findByRole('pastor');

    let filteredMentees = allMentees;

    if (country || phase) {
      filteredMentees = allMentees.filter((mentor: any) => {
        const interests = mentor.interests || [];
        return interests.some((interest: any) => {
          const church = interest.churchDetails?.[0] || {};
          return (
            (!country || church.country === country) &&
            (!phase || church.state === phase)
          );
        });
      });
    }

    const menteeDtos = filteredMentees.map((mentee) => {
      const dto = new MentorResponseDto();
      dto.id = mentee.id;
      dto.firstName = mentee.firstName;
      dto.lastName = mentee.lastName;
      dto.email = mentee.email;
      dto.username = mentee.username || '';
      dto.role = mentee.role;
      // dto.profileInfo = mentee.profileInfo || '';
      return dto;
    });

    const total = menteeDtos.length;
    const paginated = menteeDtos.slice((page - 1) * limit, page * limit);

    return { mentees: paginated, total };
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
    const notificationDoc = await this.notificationModel.findOne({ email });
    if (!notificationDoc) {
      throw new NotFoundException('No notifications found for this user');
    }
    return this.mapToResponse(notificationDoc);
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

  private mapToResponse(doc: NotificationDocument): NotificationResponseDto {
    return {
      _id: doc._id.toString(),
      email: doc.email,
      roleId: doc.roleId,
      notifications: doc.notifications.map((n) => ({
        name: n.name,
        details: n.details,
        module: n.module,
      })),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
