import { IsString, IsObject, IsNumber, IsOptional, IsBoolean, IsArray } from 'class-validator';

/**
 * Zoom webhook event payload
 * Docs: https://developers.zoom.us/docs/api/rest/webhook-reference/
 */

export class ZoomMeetingObject {
    uuid?: string;
    id: string;
    host_id: string;
    host_email?: string;
    topic: string;
    type: number;
    start_time?: string;
    duration?: number;
    timezone?: string;
    agenda?: string;
    join_url?: string;
    password?: string;
}

export class ZoomParticipant {
    user_id?: string;
    user_name?: string;
    email?: string;
    join_time?: string;
    leave_time?: string;
}

export class ZoomWebhookPayload {
    event: string;
    event_ts: number;
    payload: {
        account_id: string;
        object: ZoomMeetingObject;
        operator?: string;
        operator_id?: string;
        operation?: string;
        old_object?: ZoomMeetingObject;
        participant?: ZoomParticipant;
        time_stamp?: number;
    };
}

export class ZoomWebhookDto {
    @IsString()
    event: string;

    @IsNumber()
    event_ts: number;

    @IsObject()
    payload: ZoomWebhookPayload['payload'];
}

/**
 * DTO for creating Zoom meeting
 */
export class CreateZoomMeetingDto {
    @IsString()
    topic: string;

    @IsNumber()
    @IsOptional()
    type?: number; // 1=instant, 2=scheduled, 3=recurring no fixed time, 8=recurring fixed time

    @IsString()
    @IsOptional()
    start_time?: string; // ISO 8601 format

    @IsNumber()
    @IsOptional()
    duration?: number; // Minutes

    @IsString()
    @IsOptional()
    timezone?: string;

    @IsString()
    @IsOptional()
    agenda?: string;

    @IsOptional()
    settings?: {
        host_video?: boolean;
        participant_video?: boolean;
        join_before_host?: boolean;
        mute_upon_entry?: boolean;
        waiting_room?: boolean;
        auto_recording?: 'none' | 'local' | 'cloud';
        approval_type?: number; // 0=auto, 1=manual, 2=no registration
        registration_type?: number;
        enforce_login?: boolean;
        alternative_hosts?: string;
    };
}

/**
 * DTO for updating Zoom meeting
 */
export class UpdateZoomMeetingDto {
    @IsString()
    @IsOptional()
    topic?: string;

    @IsString()
    @IsOptional()
    start_time?: string;

    @IsNumber()
    @IsOptional()
    duration?: number;

    @IsString()
    @IsOptional()
    timezone?: string;

    @IsString()
    @IsOptional()
    agenda?: string;

    @IsOptional()
    settings?: {
        host_video?: boolean;
        participant_video?: boolean;
        join_before_host?: boolean;
        mute_upon_entry?: boolean;
        waiting_room?: boolean;
        auto_recording?: 'none' | 'local' | 'cloud';
    };
}

/**
 * DTO for Zoom user settings
 */
export class ZoomUserSettingsDto {
    @IsBoolean()
    @IsOptional()
    autoCreateMeetings?: boolean;

    @IsNumber()
    @IsOptional()
    defaultDuration?: number;

    @IsBoolean()
    @IsOptional()
    enableWaitingRoom?: boolean;

    @IsBoolean()
    @IsOptional()
    enableJoinBeforeHost?: boolean;

    @IsBoolean()
    @IsOptional()
    muteUponEntry?: boolean;

    @IsString()
    @IsOptional()
    autoRecording?: 'none' | 'local' | 'cloud';

    @IsBoolean()
    @IsOptional()
    hostVideo?: boolean;

    @IsBoolean()
    @IsOptional()
    participantVideo?: boolean;
}
