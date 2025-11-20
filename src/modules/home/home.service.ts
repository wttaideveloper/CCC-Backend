import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { Media, MediaDocument } from './schemas/media.schema';
import { S3Service } from '../s3/s3.service';
import { CreateMediaDto, UpdateMediaDto } from './dto/media.dto';

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
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    private readonly s3Service: S3Service,
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

  async createMedia(dto: CreateMediaDto, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one media file must be uploaded');
    }

    const mediaFiles: Media['mediaFiles'] = [];

    for (const file of files) {
      const mime = file.mimetype;

      const isImage = mime.startsWith('image/');
      const isVideo = mime.startsWith('video/');

      if (!isImage && !isVideo) {
        throw new BadRequestException('Only image or video files allowed');
      }

      if (isImage && file.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Image exceeds 5MB limit');
      }
      if (isVideo && file.size > 50 * 1024 * 1024) {
        throw new BadRequestException('Video exceeds 50MB limit');
      }

      const ext = file.originalname.split('.').pop();
      const timestamp = Date.now();
      const key = `media/${isVideo ? 'video' : 'image'}/${timestamp}.${ext}`;

      const url = await this.s3Service.uploadFile(
        key,
        file.buffer,
        file.mimetype,
      );

      mediaFiles.push({
        url,
        type: isVideo ? 'video' : 'image',
        fileName: key,
        size: file.size,
        uploadedAt: new Date(),
      });
    }

    const saved = await this.mediaModel.create({
      heading: dto.heading,
      subheading: dto.subheading,
      description: dto.description,
      mediaFiles,
    });

    return saved;
  }

  async findAllMedia() {
    return await this.mediaModel.find().sort({ createdAt: -1 }).lean();
  }

  async findOneMedia(id: string) {
    const media = await this.mediaModel.findById(id).lean();
    if (!media) throw new NotFoundException('Media not found');
    return media;
  }


  async updateMedia(id: string, dto: UpdateMediaDto, files?: Express.Multer.File[]) {
    const media = await this.mediaModel.findById(id);
    if (!media) throw new NotFoundException('Media not found');

    const updatedFiles = [...media.mediaFiles];

    if (files && files.length > 0) {
      for (const file of files) {
        const mime = file.mimetype;
        const isImage = mime.startsWith('image/');
        const isVideo = mime.startsWith('video/');

        if (!isImage && !isVideo) {
          throw new BadRequestException('Only image or video allowed');
        }

        const ext = file.originalname.split('.').pop();
        const timestamp = Date.now();
        const key = `media/${isVideo ? 'video' : 'image'}/${id}_${timestamp}.${ext}`;

        const url = await this.s3Service.uploadFile(
          key,
          file.buffer,
          file.mimetype,
        );

        updatedFiles.push({
          url,
          type: isVideo ? 'video' : 'image',
          fileName: key,
        });
      }
    }

    const updated = await this.mediaModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            heading: dto.heading ?? media.heading,
            subheading: dto.subheading ?? media.subheading,
            description: dto.description ?? media.description,
            mediaFiles: updatedFiles,
          },
        },
        { new: true },
      )
      .lean();

    return updated;
  }

  async deleteMedia(id: string) {
    const deleted = await this.mediaModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Media not found');
    return deleted;
  }
}
