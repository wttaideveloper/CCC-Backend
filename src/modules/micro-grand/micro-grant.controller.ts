import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MicroGrantService } from './micro-grant.service';
import {
  ApplyMicroGrantDto,
  CreateOrUpdateFormDto,
  UpdateApplicationStatusDto,
} from './dto/micro-grant.dto';

@Controller('microgrant')
export class MicroGrantController {
  constructor(private readonly microGrantService: MicroGrantService) {}

  @Post('form')
  async createOrUpdateForm(@Body() dto: CreateOrUpdateFormDto) {
    const form = await this.microGrantService.createOrUpdateForm(dto);
    return { success: true, message: 'Form saved successfully', data: form };
  }

  @Get('form')
  async getForm() {
    const result = await this.microGrantService.getForm();
    return {
      success: true,
      message: 'Form fetched successfully',
      data: result,
    };
  }

  @Post('apply')
  async applyForGrant(@Body() dto: ApplyMicroGrantDto) {
    const result = await this.microGrantService.applyForGrant(dto);
    return {
      success: true,
      message: 'Micro grant application submitted successfully',
      data: result,
    };
  }

  @Get('applications')
  async getApplications(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.microGrantService.getApplications(status, search);
    return {
      success: true,
      message: 'Applications fetched successfully',
      data: result,
    };
  }

  @Get('application/:userId')
  async getUserApplication(@Param('userId') userId: string) {
    const result = await this.microGrantService.getUserApplication(userId);
    return {
      success: true,
      message: 'Fetched user application successfully',
      data: result,
    };
  }

  @Patch('application/:id/status')
  async updateApplicationStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    const result = await this.microGrantService.updateApplicationStatus(
      id,
      dto.status,
    );
    return {
      success: true,
      message: result.message,
      data: result.application,
    };
  }
}
