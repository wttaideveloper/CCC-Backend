import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Interest, InterestDocument } from './schemas/interest.schema';
import { CreateInterestDto } from './dto/create-interest.dto';
import { InterestResponseDto } from './dto/interest-response.dto';
import { toInterestResponseDto } from './utils/interest.mapper';
import { COUNTRIES_STATES_LIST, INTERESTS_LIST, TITLES_LIST } from 'src/shared/constants/metadata.constants';
import { InterestMetadataDto } from './dto/interestMetadata.dto';

@Injectable()
export class InterestService {
  constructor(
    @InjectModel(Interest.name)
    private readonly interestModel: Model<InterestDocument>,
  ) { }

  async create(dto: CreateInterestDto): Promise<InterestResponseDto> {
    const interest = await this.interestModel.create(dto);
    return toInterestResponseDto(interest);
  }

  async findAll(): Promise<InterestResponseDto[]> {
    const interests = await this.interestModel.find().sort({ createdAt: -1 }).exec();
    return interests.map(toInterestResponseDto);
  }

  async getMetadata(): Promise<InterestMetadataDto> {
    const countriesList = COUNTRIES_STATES_LIST.map(item => item.country);
    return {
      titles: TITLES_LIST,
      countries: countriesList,
      countryStates: COUNTRIES_STATES_LIST,
      interests: INTERESTS_LIST
    };
  }

  async findByEmail(email: string): Promise<InterestResponseDto> {
    const interest = await this.interestModel.findOne({ email }).exec();
    if (!interest) throw new Error('Interest form not found');
    return toInterestResponseDto(interest);
  }
}