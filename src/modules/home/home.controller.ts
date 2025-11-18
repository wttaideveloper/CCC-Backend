import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BaseResponse } from 'src/shared/interfaces/base-response.interface';
import { HomeService } from './home.service';
import { HomeResponseDto } from './dto/home-response.dto';
import { MentorResponseDto } from './dto/mentor-response.dto';
import {
  AddNotificationDto,
  NotificationResponseDto,
} from './dto/notification.dto';
// import { JwtAuthGuard, RolesGuard } from '../../common/guards';
// import { Roles } from '../../common/decorators';
// import { ROLES } from '../../common/constants/roles.constants';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
import { CreateVideoDto, UpdateVideoDto } from './dto/video.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('home')
// @UseGuards(JwtAuthGuard, RolesGuard)
export class HomeController {
  constructor(private readonly homeService: HomeService) { }

  @Get('mentor/:email')
  // @Roles(ROLES.DIRECTOR, ROLES.PASTOR)
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
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR, ROLES.FIELD_MENTOR)
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
  // @Roles(ROLES.DIRECTOR, ROLES.PASTOR)
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
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR, ROLES.FIELD_MENTOR)
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

  @Delete('notifications/:email/:notificationId')
  async deleteNotification(
    @Param('email') email: string,
    @Param('notificationId', ParseMongoIdPipe) notificationId: string,
  ): Promise<BaseResponse<NotificationResponseDto>> {
    const result = await this.homeService.deleteNotification(
      email,
      notificationId,
    );
    return {
      success: true,
      message: 'Notification deleted successfully',
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

  @Post("videos")
  @UseInterceptors(FileInterceptor('file'))
  async create(@Body() dto: CreateVideoDto, @UploadedFile() file: Express.Multer.File) {
    const data = await this.homeService.createVideo(dto, file);
    return { success: true, message: 'Video uploaded', data };
  }

  @Get()
  async findAllVideos(): Promise<BaseResponse<any>> {
    const data = await this.homeService.findAllVideos();
    return { success: true, message: 'Videos fetched', data };
  }

  @Get(':id')
  async findOneVideo(@Param('id') id: string): Promise<BaseResponse<any>> {
    const data = await this.homeService.findOneVideo(id);
    return { success: true, message: 'Video fetched', data };
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async updateVideo(
    @Param('id') id: string,
    @Body() dto: UpdateVideoDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data = await this.homeService.updateVideo(id, dto, file);
    return { success: true, message: 'Video updated', data };
  }

  @Delete(':id')
  async deleteVideo(@Param('id') id: string): Promise<BaseResponse<any>> {
    const data = await this.homeService.deleteVideo(id);
    return { success: true, message: 'Video deleted', data };
  }
}
