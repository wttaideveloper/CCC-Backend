import { IsMongoId, IsNotEmpty, IsString, IsEmail } from 'class-validator';
import { Types } from 'mongoose';

export class InviteFieldMentorDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsMongoId()
    @IsNotEmpty()
    invitedBy: Types.ObjectId;
}

export class AcceptInvitationDto {
    @IsString()
    @IsNotEmpty()
    token: string;
}

export class MarkCompletedDto {
    @IsMongoId()
    @IsNotEmpty()
    userId: Types.ObjectId;
}

export class IssueCertificateDto {
    @IsMongoId()
    @IsNotEmpty()
    userId: Types.ObjectId;

    @IsMongoId()
    @IsNotEmpty()
    issuedBy: Types.ObjectId;
}
