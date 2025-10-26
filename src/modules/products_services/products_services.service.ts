import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Scholarship,
  ScholarshipDocument,
} from './schemas/scholarship.schema';
import { CreateScholarshipDto } from './dto/create-scholarship.dto';
import { UpdateScholarshipDto } from './dto/update-scholarship.dto';
import { ScholarshipResponseDto } from './dto/scholarship-response.dto';
import { toScholarshipResponseDto } from './utils/scholarship.mapper';
import { AwardedUserDto } from './dto/awarded-item.dto';

@Injectable()
export class ProductsServicesService {
  constructor(
    @InjectModel(Scholarship.name)
    private readonly scholarshipModel: Model<ScholarshipDocument>,
  ) {}

  async createScholarship(
    dto: CreateScholarshipDto,
  ): Promise<ScholarshipResponseDto> {
    // Check if scholarship type already exists (only 5 types allowed, each unique)
    const existing = await this.scholarshipModel
      .findOne({ type: dto.type })
      .exec();

    if (existing) {
      throw new BadRequestException(
        'Scholarship type already exists. Only one scholarship per type is allowed.',
      );
    }

    const scholarship = new this.scholarshipModel(dto);

    const saved = await scholarship.save();
    return toScholarshipResponseDto(saved);
  }

  async findAllScholarships(): Promise<ScholarshipResponseDto[]> {
    const scholarships = await this.scholarshipModel.find().exec();
    return scholarships.map((scholarship) =>
      toScholarshipResponseDto(scholarship),
    );
  }

  async findScholarshipById(id: string): Promise<ScholarshipResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid scholarship ID format');
    }

    const scholarship = await this.scholarshipModel.findById(id).exec();

    if (!scholarship) {
      throw new NotFoundException('Scholarship not found');
    }

    return toScholarshipResponseDto(scholarship);
  }

  async updateScholarship(
    id: string,
    updateDto: UpdateScholarshipDto,
  ): Promise<ScholarshipResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid scholarship ID format');
    }

    // If type is being updated, check if new type already exists
    if (updateDto.type) {
      const existing = await this.scholarshipModel
        .findOne({ type: updateDto.type, _id: { $ne: id } })
        .exec();

      if (existing) {
        throw new BadRequestException(
          'Scholarship type already exists. Only one scholarship per type is allowed.',
        );
      }
    }

    const updated = await this.scholarshipModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Scholarship not found');
    }

    return toScholarshipResponseDto(updated);
  }

  async deleteScholarship(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid scholarship ID format');
    }

    const result = await this.scholarshipModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException('Scholarship not found');
    }
  }

  // Add an awarded user to the scholarship
  async addAwardedUser(
    scholarshipId: string,
    awardedUser: AwardedUserDto,
  ): Promise<ScholarshipResponseDto> {
    if (!Types.ObjectId.isValid(scholarshipId)) {
      throw new BadRequestException('Invalid scholarship ID format');
    }

    const scholarship = await this.scholarshipModel
      .findById(scholarshipId)
      .exec();

    if (!scholarship) {
      throw new NotFoundException('Scholarship not found');
    }

    // Check if user already has this scholarship
    const existingUser = scholarship.awardedList.find(
      (user) => user.userId.toString() === awardedUser.userId,
    );

    if (existingUser) {
      throw new BadRequestException(
        'User already has this scholarship awarded',
      );
    }

    // Convert userId string to ObjectId
    const newUser = {
      userId: new Types.ObjectId(awardedUser.userId),
      awardedDate: new Date(awardedUser.awardedDate),
      notes: awardedUser.notes,
      academicYear: awardedUser.academicYear,
      awardStatus: awardedUser.awardStatus || 'active',
    };

    scholarship.awardedList.push(newUser);
    const updated = await scholarship.save();

    return toScholarshipResponseDto(updated);
  }

  // Update a specific awarded user
  async updateAwardedUser(
    scholarshipId: string,
    awardedUserIndex: number,
    updateData: Partial<AwardedUserDto>,
  ): Promise<ScholarshipResponseDto> {
    if (!Types.ObjectId.isValid(scholarshipId)) {
      throw new BadRequestException('Invalid scholarship ID format');
    }

    const scholarship = await this.scholarshipModel
      .findById(scholarshipId)
      .exec();

    if (!scholarship) {
      throw new NotFoundException('Scholarship not found');
    }

    if (
      awardedUserIndex < 0 ||
      awardedUserIndex >= scholarship.awardedList.length
    ) {
      throw new BadRequestException('Invalid awarded user index');
    }

    // Update the specific user
    const userToUpdate = scholarship.awardedList[awardedUserIndex];

    if (updateData.userId) {
      userToUpdate.userId = new Types.ObjectId(updateData.userId);
    }
    if (updateData.awardedDate) {
      userToUpdate.awardedDate = new Date(updateData.awardedDate);
    }
    if (updateData.notes !== undefined) {
      userToUpdate.notes = updateData.notes;
    }
    if (updateData.academicYear !== undefined) {
      userToUpdate.academicYear = updateData.academicYear;
    }
    if (updateData.awardStatus) {
      userToUpdate.awardStatus = updateData.awardStatus;
    }

    const updated = await scholarship.save();
    return toScholarshipResponseDto(updated);
  }

  // Remove an awarded user from the scholarship
  async removeAwardedUser(
    scholarshipId: string,
    awardedUserIndex: number,
  ): Promise<ScholarshipResponseDto> {
    if (!Types.ObjectId.isValid(scholarshipId)) {
      throw new BadRequestException('Invalid scholarship ID format');
    }

    const scholarship = await this.scholarshipModel
      .findById(scholarshipId)
      .exec();

    if (!scholarship) {
      throw new NotFoundException('Scholarship not found');
    }

    if (
      awardedUserIndex < 0 ||
      awardedUserIndex >= scholarship.awardedList.length
    ) {
      throw new BadRequestException('Invalid awarded user index');
    }

    scholarship.awardedList.splice(awardedUserIndex, 1);
    const updated = await scholarship.save();

    return toScholarshipResponseDto(updated);
  }

  // Get scholarship by type
  async findScholarshipByType(type: string): Promise<ScholarshipResponseDto> {
    const scholarship = await this.scholarshipModel.findOne({ type }).exec();

    if (!scholarship) {
      throw new NotFoundException('Scholarship not found');
    }

    return toScholarshipResponseDto(scholarship);
  }

  // Get scholarships by status
  async findScholarshipsByStatus(
    status: string,
  ): Promise<ScholarshipResponseDto[]> {
    const scholarships = await this.scholarshipModel.find({ status }).exec();
    return scholarships.map((scholarship) =>
      toScholarshipResponseDto(scholarship),
    );
  }

  // Get total statistics across all scholarships
  async getScholarshipStatistics(): Promise<{
    totalScholarships: number;
    totalAwardsGiven: number;
    totalAmountDisbursed: number;
    activeScholarships: number;
  }> {
    const scholarships = await this.scholarshipModel.find().exec();

    const stats = scholarships.reduce(
      (acc, scholarship) => {
        acc.totalScholarships += 1;
        acc.totalAwardsGiven += scholarship.numberOfAwards || 0;
        acc.totalAmountDisbursed += scholarship.totalAmount || 0;
        if (scholarship.status === 'active') {
          acc.activeScholarships += 1;
        }
        return acc;
      },
      {
        totalScholarships: 0,
        totalAwardsGiven: 0,
        totalAmountDisbursed: 0,
        activeScholarships: 0,
      },
    );

    return stats;
  }
}
