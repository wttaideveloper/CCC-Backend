import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { BaseResponse } from '../../shared/interfaces/base-response.interface';
import { UserResponseDto } from './dto/user-response.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
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
  async getAllUsers(): Promise<BaseResponse<UserResponseDto[]>> {
    const users = await this.usersService.findAll();
    return {
      success: true,
      message: 'Users fetched successfully',
      data: users,
    };
  }

  @Get('check-status/:id')
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

  @Get(':id')
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
  async updateUser(
    @Param('id') id: string,
    @Body() updateData: Partial<UserResponseDto>,
  ): Promise<BaseResponse<UserResponseDto>> {
    const updated = await this.usersService.update(id, updateData);
    return {
      success: true,
      message: 'User updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string): Promise<BaseResponse<null>> {
    await this.usersService.delete(id);
    return {
      success: true,
      message: 'User deleted successfully',
      data: null,
    };
  }
}
