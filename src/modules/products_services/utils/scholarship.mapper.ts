import { Types } from 'mongoose';
import { ScholarshipDocument } from '../schemas/scholarship.schema';
import {
  ScholarshipResponseDto,
  AwardedUserResponseDto,
} from '../dto/scholarship-response.dto';

export function toScholarshipResponseDto(
  scholarship: ScholarshipDocument | any,
): ScholarshipResponseDto {

  const awardedList: AwardedUserResponseDto[] = (scholarship.awardedList || []).map(
    (item) => ({
      userId:
        item.userId instanceof Types.ObjectId
          ? item.userId.toString()
          : item.userId?._id?.toString(),

      user:
        item.userId instanceof Types.ObjectId
          ? null
          : item.userId,

      awardedDate: item.awardedDate,
      notes: item.notes,
      academicYear: item.academicYear,
      awardStatus: item.awardStatus,
    }),
  );

  return {
    id: scholarship._id?.toString(),
    type: scholarship.type,
    amount: scholarship.amount,
    description: scholarship.description,
    status: scholarship.status,
    awardedList,
    numberOfAwards: scholarship.numberOfAwards || 0,
    totalAmount: scholarship.totalAmount || 0,
    createdAt: scholarship.createdAt,
    updatedAt: scholarship.updatedAt,
  };
}