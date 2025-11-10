import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  NotFoundException,
  // UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BaseResponse } from '../../shared/interfaces/base-response.interface';
import { AssignMentorDto, UserResponseDto } from './dto/user-response.dto';
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';
// import { ROLES } from 'src/common/constants/roles.constants';

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

  @Post(':userId/assign-mentor')
  async assignMentor(
    @Param('userId') userId: string,
    @Body() dto: AssignMentorDto,
  ) {
    const user = await this.usersService.assignMentor(userId, dto);
    if (!user) throw new NotFoundException('User not found');

    return {
      success: true,
      message: 'Mentor assigned successfully',
      data: user,
    };
  }

  @Get(':userId/mentors')
  async getMentorList(@Param('userId') userId: string) {
    const mentors = await this.usersService.getMentorList(userId);
    return {
      success: true,
      message: 'Mentor list fetched successfully',
      data: mentors,
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
