import { Body, Controller, Get, Post } from '@nestjs/common';
import { InterestService } from './interests.service';
import { CreateInterestDto } from './dto/create-interest.dto';
import { BaseResponse } from '../../shared/interfaces/base-response.interface';
import { InterestResponseDto } from './dto/interest-response.dto';
import { InterestMetadataDto } from './dto/interestMetadata.dto';

@Controller('interests')
export class InterestController {
    constructor(private readonly interestService: InterestService) { }

    @Post()
    async create(@Body() dto: CreateInterestDto): Promise<BaseResponse<InterestResponseDto>> {
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
}
