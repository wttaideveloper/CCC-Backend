import { InterestDocument, ChurchDetails } from '../schemas/interest.schema';
import { InterestResponseDto, ChurchDetailsResponseDto } from '../dto/interest-response.dto';

function mapChurchDetails(details: ChurchDetails): ChurchDetailsResponseDto {
    return {
        churchName: details.churchName,
        churchPhone: details.churchPhone,
        churchWebsite: details.churchWebsite,
        churchAddress: details.churchAddress,
        city: details.city,
        state: details.state,
        zipCode: details.zipCode,
        country: details.country,
    };
}

export function toInterestResponseDto(interest: InterestDocument | any): InterestResponseDto {

    return {
        id: interest._id?.toString() || String(interest._id),
        profileInfo: interest.profileInfo,
        firstName: interest.firstName,
        lastName: interest.lastName,
        phoneNumber: interest.phoneNumber,
        email: interest.email,
        profilePicture: interest.profilePicture,
        churchDetails: (interest.churchDetails || []).map(mapChurchDetails),
        title: interest.title,
        conference: interest.conference,
        yearsInMinistry: interest.yearsInMinistry,
        currentCommunityProjects: interest.currentCommunityProjects,
        interests: interest.interests,
        comments: interest.comments,
        userId: interest.userId?.toString(),
        status: interest.status || 'new',
    };
}