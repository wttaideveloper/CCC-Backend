import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  // UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BaseResponse } from '../../shared/interfaces/base-response.interface';
import { AssignMentorMenteeDto, RemoveMentorMenteeDto, UserResponseDto } from './dto/user-response.dto';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';
// import { ROLES } from 'src/common/constants/roles.constants';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';

@Controller('users')
// @UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR, ROLES.PASTOR)
  async createUser(
    @Body() dto: CreateUserDto,
  ): Promise<BaseResponse<UserResponseDto>> {
    const user = await this.usersService.create(dto);
    return {
      success: true,
      message: 'User created successfully',
      data: user,
    };
  }

  @Get()
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR, ROLES.FIELD_MENTOR, ROLES.PASTOR)
  async getAllUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
  ): Promise<BaseResponse<UserResponseDto[]>> {
    const filters = { role, status };
    const users = await this.usersService.findAll(filters);
    return {
      success: true,
      message: 'Users fetched successfully',
      data: users,
    };
  }

  @Get('check-status/:id')
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR, ROLES.FIELD_MENTOR, ROLES.PASTOR)
  async checkUserStatus(
    @Param('id') userId: string,
  ): Promise<BaseResponse<{ status: string }>> {
    const userStatus = await this.usersService.checkUserStatus(userId);
    return {
      success: true,
      message: 'User status fetched successfully',
      data: { status: userStatus },
    };
  }

  @Post(':userId/assign')
  async assignUsers(
    @Param('userId', ParseMongoIdPipe) userId: string,
    @Body() dto: AssignMentorMenteeDto,
  ) {
    const result = await this.usersService.assignUsers(userId, dto);
    return {
      success: true,
      message: 'Users assigned successfully',
      data: result,
    };
  }

  @Patch(':userId/remove')
  async removeAssignedUsers(
    @Param('userId', ParseMongoIdPipe) userId: string,
    @Body() dto: RemoveMentorMenteeDto,
  ) {
    const result = await this.usersService.removeUsers(userId, dto);
    return {
      success: true,
      message: 'Users removed successfully',
      data: result,
    };
  }

  @Get(':userId/assigned')
  async getAssignedUsers(@Param('userId', ParseMongoIdPipe) userId: string) {
    const assignedUsers = await this.usersService.getAssignedUsers(userId);
    return {
      success: true,
      message: 'Assigned users fetched successfully',
      data: assignedUsers,
    };
  }

  @Get(':id')
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR, ROLES.FIELD_MENTOR, ROLES.PASTOR)
  async getUser(
    @Param('id') id: string,
  ): Promise<BaseResponse<UserResponseDto>> {
    const user = await this.usersService.findById(id);
    return {
      success: true,
      message: 'User fetched successfully',
      data: user,
    };
  }

  @Patch(':id')
  // @Roles(ROLES.DIRECTOR, ROLES.MENTOR, ROLES.FIELD_MENTOR, ROLES.PASTOR)
  async updateUser(
    @Param('id') id: string,
    @Body() updateData: UpdateUserDto,
  ): Promise<BaseResponse<UserResponseDto>> {
    const updated = await this.usersService.update(id, updateData);
    return {
      success: true,
      message: 'User updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  // @Roles(ROLES.DIRECTOR)
  async deleteUser(@Param('id') id: string): Promise<BaseResponse<null>> {
    await this.usersService.delete(id);
    return {
      success: true,
      message: 'User deleted successfully',
      data: null,
    };
  }
}
