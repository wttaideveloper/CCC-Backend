import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InterestService } from './interests.service';
import {
  CreateInterestDto,
  UpdateInterestDto,
} from './dto/create-interest.dto';
import { BaseResponse } from '../../shared/interfaces/base-response.interface';
import { InterestResponseDto } from './dto/interest-response.dto';
import { InterestMetadataDto } from './dto/interestMetadata.dto';

@Controller('interests')
export class InterestController {
  constructor(private readonly interestService: InterestService) {}

  @Post()
  async create(
    @Body() dto: CreateInterestDto,
  ): Promise<BaseResponse<InterestResponseDto>> {
    const data = await this.interestService.create(dto);
    return {
      success: true,
      message: 'Interest form submitted successfully',
      data,
    };
  }

  @Get()
  async getAll(): Promise<BaseResponse<InterestResponseDto[]>> {
    const data = await this.interestService.findAll();
    return {
      success: true,
      message: 'All interest forms fetched successfully',
      data,
    };
  }

    @Get('metadata')
    async getMetadata(): Promise<BaseResponse<InterestMetadataDto>> {
        const data = await this.interestService.getMetadata();
        return {
            success: true,
            message: 'Metadata fetched successfully',
            data,
        };
    }

    @Get('request')
    async getInterestsByStatus(
        @Query('status') status: string,
        @Query('limit') limit?: string,
    ) {
        const parsedLimit = limit ? parseInt(limit, 10) : 10;
        return this.interestService.getInterestsByStatus(status, parsedLimit);
    }

    @Patch('request/:userId')
    async updateUserStatus(
        @Param('userId') userId: string,
        @Body('status') status: 'pending' | 'accepted' | 'rejected',
    ) {
        return this.interestService.updateUserStatus(userId, status);
    }

  @Get(':email')
  async getByEmail(
    @Param('email') email: string,
  ): Promise<BaseResponse<InterestResponseDto>> {
    const data = await this.interestService.findByEmail(email);
    return {
      success: true,
      message: 'Interest form fetched successfully',
      data,
    };
  }

  @Patch(':email')
  async update(
    @Param('email') email: string,
    @Body() dto: UpdateInterestDto,
  ): Promise<BaseResponse<InterestResponseDto>> {
    const data = await this.interestService.update(email, dto);
    return {
      success: true,
      message: 'Interest form updated successfully',
      data,
    };
  }
}
