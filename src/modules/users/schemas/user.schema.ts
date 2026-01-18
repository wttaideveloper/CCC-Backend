import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { nanoid } from 'nanoid';
import { ROLES } from '../../../common/constants/roles.constants';
import {
  USER_STATUSES,
  VALID_USER_STATUSES,
} from '../../../common/constants/status.constants';

export type UserDocument = Document<unknown, {}, User> &
  User & {
    _id: Types.ObjectId;
  };

const VALID_ROLES = Object.values(ROLES);

@Schema({ timestamps: true })
export class User {
  readonly _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Interest' })
  interestId?: Types.ObjectId;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ unique: true, sparse: true })
  username?: string;

  @Prop()
  password?: string;

  @Prop({ enum: VALID_ROLES, default: ROLES.PENDING })
  role: string;

  @Prop({
    required: true,
    unique: true,
    default: () => nanoid(),
    index: true,
  })
  roleId: string;

  @Prop()
  profilePicture?: string;

  @Prop({
    enum: VALID_USER_STATUSES,
    default: USER_STATUSES.PENDING,
  })
  status: string;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop()
  refreshToken?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  assignedId: Types.ObjectId[];

  @Prop({
    type: [{
      fileName: { type: String, required: true },
      fileUrl: { type: String, required: true },
      fileType: { type: String, required: true },
      fileSize: { type: Number, required: true },
      uploadedAt: { type: Date, default: Date.now },
    }],
    default: [],
  })
  uploadedDocuments: {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    uploadedAt: Date;
  }[];

  @Prop({ type: Boolean, default: false })
  hasCompleted: boolean;

  @Prop({ type: Boolean, default: false })
  hasIssuedCertificate: boolean;

  @Prop({
    type: {
      invitedBy: { type: Types.ObjectId, ref: 'User' },
      invitedAt: { type: Date },
      token: { type: String },
      expiresAt: { type: Date },
    },
  })
  fieldMentorInvitation?: {
    invitedBy: Types.ObjectId;
    invitedAt: Date;
    token: string;
    expiresAt: Date;
  };

  @Prop({
    type: {
      calendlyUsername: { type: String },
      calendlyUserUri: { type: String },
      organizationUri: { type: String },
      accessToken: { type: String },
      refreshToken: { type: String },
      tokenExpiresAt: { type: Date },
      eventTypes: [{
        uuid: { type: String },
        name: { type: String },
        url: { type: String },
        duration: { type: Number },
        targetRole: { type: String },
        active: { type: Boolean, default: true },
        pooling: { type: Boolean, default: false },
        color: { type: String },
        internalNote: { type: String }
      }],
      connectedAt: { type: Date },
      lastSyncedAt: { type: Date }
    },
  })
  calendlyConfig?: {
    calendlyUsername: string;
    calendlyUserUri: string;
    organizationUri: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    eventTypes: Array<{
      uuid: string;
      name: string;
      url: string;
      duration: number;
      targetRole: string;
      active: boolean;
      pooling: boolean;
      color: string;
      internalNote?: string;
    }>;
    connectedAt: Date;
    lastSyncedAt?: Date;
  };

  @Prop({
    type: {
      accountId: { type: String },
      email: { type: String },
      accessToken: { type: String },
      refreshToken: { type: String },
      tokenExpiresAt: { type: Date },
      tokenType: { type: String },
      scope: { type: String },
      connectedAt: { type: Date },
      lastSyncedAt: { type: Date },
      settings: {
        autoCreateMeetings: { type: Boolean, default: true },
        defaultDuration: { type: Number, default: 60 },
        enableWaitingRoom: { type: Boolean, default: true },
        enableJoinBeforeHost: { type: Boolean, default: true },
        muteUponEntry: { type: Boolean, default: false },
        autoRecording: { type: String, enum: ['none', 'local', 'cloud'], default: 'none' },
        hostVideo: { type: Boolean, default: true },
        participantVideo: { type: Boolean, default: true }
      }
    },
  })
  zoomConfig?: {
    accountId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    tokenType: string;
    scope: string;
    connectedAt: Date;
    lastSyncedAt?: Date;
    settings: {
      autoCreateMeetings: boolean;
      defaultDuration: number;
      enableWaitingRoom: boolean;
      enableJoinBeforeHost: boolean;
      muteUponEntry: boolean;
      autoRecording: 'none' | 'local' | 'cloud';
      hostVideo: boolean;
      participantVideo: boolean;
    };
  };
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ interestId: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ assignedId: 1, status: 1 });
UserSchema.index({ firstName: 'text', lastName: 'text', email: 'text', username: 'text' });
