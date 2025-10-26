import { Body, Controller, Get, Post } from '@nestjs/common';
import { MicroGrantService } from './micro-grant.service';
import { CreateOrUpdateFormDto } from './dto/micro-grant.dto';

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
}
