import { ScholarshipDocument } from '../schemas/scholarship.schema';
import {
  ScholarshipResponseDto,
  AwardedUserResponseDto,
} from '../dto/scholarship-response.dto';

export function toScholarshipResponseDto(
  scholarship: ScholarshipDocument,
): ScholarshipResponseDto {
  const awardedList: AwardedUserResponseDto[] = scholarship.awardedList.map(
    (user) => ({
      userId: user.userId.toString(),
      awardedDate: user.awardedDate,
      notes: user.notes,
      academicYear: user.academicYear,
      awardStatus: user.awardStatus,
    }),
  );

  return {
    id: scholarship._id.toString(),
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
