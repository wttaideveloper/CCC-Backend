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
import { SCHOLARSHIP_STATUSES } from '../../common/constants/status.constants';

@Injectable()
export class ProductsServicesService {
    constructor(
        @InjectModel(Scholarship.name)
        private readonly scholarshipModel: Model<ScholarshipDocument>,
    ) { }

    async createScholarship(
        dto: CreateScholarshipDto,
    ): Promise<ScholarshipResponseDto> {
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
        const scholarships = await this.scholarshipModel.find().lean().exec();
        return scholarships.map((scholarship) =>
            toScholarshipResponseDto(scholarship),
        );
    }

    async findScholarshipById(id: string): Promise<ScholarshipResponseDto> {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid scholarship ID format');
        }

        const scholarship = await this.scholarshipModel.findById(id).lean().exec();

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

        const existingUser = scholarship.awardedList.find(
            (user) => user.userId.toString() === awardedUser.userId,
        );

        if (existingUser) {
            throw new BadRequestException(
                'User already has this scholarship awarded',
            );
        }

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

    async findScholarshipByType(type: string): Promise<ScholarshipResponseDto> {
        const scholarship = await this.scholarshipModel.findOne({ type }).lean().exec();

        if (!scholarship) {
            throw new NotFoundException('Scholarship not found');
        }

        return toScholarshipResponseDto(scholarship as any);
    }

    async findScholarshipsByStatus(
        status: string,
    ): Promise<ScholarshipResponseDto[]> {
        const scholarships = await this.scholarshipModel.find({ status }).lean().exec();
        return scholarships.map((scholarship) =>
            toScholarshipResponseDto(scholarship as any),
        );
    }

    async getScholarshipStatistics(): Promise<{
        totalScholarships: number;
        totalAwardsGiven: number;
        totalAmountDisbursed: number;
        activeScholarships: number;
    }> {
        const result = await this.scholarshipModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalScholarships: { $sum: 1 },
                    totalAwardsGiven: { $sum: { $ifNull: ['$numberOfAwards', 0] } },
                    totalAmountDisbursed: { $sum: { $ifNull: ['$totalAmount', 0] } },
                    activeScholarships: {
                        $sum: { $cond: [{ $eq: ['$status', SCHOLARSHIP_STATUSES.ACTIVE] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalScholarships: 1,
                    totalAwardsGiven: 1,
                    totalAmountDisbursed: 1,
                    activeScholarships: 1
                }
            }
        ]).exec();

        return result[0] || {
            totalScholarships: 0,
            totalAwardsGiven: 0,
            totalAmountDisbursed: 0,
            activeScholarships: 0,
        };
    }
}
