import { ScholarshipDocument } from '../schemas/scholarship.schema';
import {
  ScholarshipResponseDto,
  AwardedUserResponseDto,
} from '../dto/scholarship-response.dto';

export function toScholarshipResponseDto(
  scholarship: ScholarshipDocument | any,
): ScholarshipResponseDto {
  const awardedList: AwardedUserResponseDto[] = (scholarship.awardedList || []).map(
    (user) => ({
      userId: user.userId?.toString() || String(user.userId),
      awardedDate: user.awardedDate,
      notes: user.notes,
      academicYear: user.academicYear,
      awardStatus: user.awardStatus,
    }),
  );

  return {
    id: scholarship._id?.toString() || String(scholarship._id),
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
