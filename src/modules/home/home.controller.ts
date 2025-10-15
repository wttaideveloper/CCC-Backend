import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BaseResponse } from 'src/shared/interfaces/base-response.interface';
import { HomeService } from './home.service';
import { HomeResponseDto } from './dto/home-response.dto';
import { MentorResponseDto } from './dto/mentor-response.dto';
import {
  AddNotificationDto,
  NotificationResponseDto,
} from './dto/notification.dto';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  // @Get('mentors')
  // async getMentors(): Promise<BaseResponse<MentorDto>> {
  //     const mentors = await this.homeService.getMentors();

  //     return {
  //         success: true,
  //         message: 'Home details fetched successfully',
  //         data: mentors
  //     };

  // }

  // @Get('video/:email')
  // async getHomeVideos(@Param('email') email: string): Promise<BaseResponse<HomeVideoDto>> {
  //     const videos = await this.homeService.getVideos(email);
  //     return {
  //         success: true,
  //         message: 'Home videos fetched successfully',
  //         data: videos
  //     };
  // }

  @Get('mentor/:email')
  async getMentorByEmail(
    @Param('email') email: string,
  ): Promise<BaseResponse<MentorResponseDto>> {
    const mentor = await this.homeService.getMentorByEmail(email);
    return {
      success: true,
      message: 'Mentor fetched successfully',
      data: mentor,
    };
  }

  @Get('mentee/:email')
  async getMenteeByEmail(
    @Param('email') email: string,
  ): Promise<BaseResponse<MentorResponseDto>> {
    const mentee = await this.homeService.getMenteeByEmail(email);

    return {
      success: true,
      message: 'Mentee fetched successfully',
      data: mentee,
    };
  }

  @Get('mentors')
  async getAllMentors(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('country') country?: string,
    @Query('state') state?: string,
    @Query('conference') conference?: string,
    @Query('role') role?: string,
  ): Promise<BaseResponse<{ mentors: MentorResponseDto[]; total: number }>> {
    const result = await this.homeService.getAllMentors({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      country,
      state,
      conference,
      role,
    });

    return {
      success: true,
      message: 'Mentors list fetched successfully',
      data: result,
    };
  }

  @Get('mentees')
  async getAllMentees(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('phase') phase?: string,
    @Query('country') country?: string,
  ): Promise<BaseResponse<{ mentees: MentorResponseDto[]; total: number }>> {
    const result = await this.homeService.getAllMentees({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      phase,
      country,
    });

    return {
      success: true,
      message: 'Mentees list fetched successfully',
      data: result,
    };
  }

  @Get(':email')
  async getHomeDetails(
    @Param('email') email: string,
  ): Promise<BaseResponse<HomeResponseDto>> {
    const home = await this.homeService.getByEmail(email);
    return {
      success: true,
      message: 'Home details fetched successfully',
      data: home,
    };
  }

  @Post('notifications')
  async addNotification(
    @Body() dto: AddNotificationDto,
  ): Promise<BaseResponse<NotificationResponseDto>> {
    const result = await this.homeService.addNotification(dto);
    return {
      success: true,
      message: 'Notification added successfully',
      data: result,
    };
  }

  @Get('notifications/:email')
  async getNotifications(
    @Param('email') email: string,
  ): Promise<BaseResponse<NotificationResponseDto>> {
    const result = await this.homeService.getNotifications(email);
    return {
      success: true,
      message: 'Notifications fetched successfully',
      data: result,
    };
  }
}
