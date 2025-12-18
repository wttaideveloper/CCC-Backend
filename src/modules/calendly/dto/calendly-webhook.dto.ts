import { IsString, IsObject, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class QuestionAnswer {
    question: string;
    answer: string;
    position: number;
}

export class CalendlyInvitee {
    uri: string;
    email: string;
    name: string;
    first_name?: string;
    last_name?: string;
    canceled: boolean;
    cancellation?: {
        canceled_by: string;
        reason: string;
        canceler_type: string;
    };
    timezone?: string;
    created_at: string;
    updated_at: string;
}

export class CalendlyEvent {
    uri: string;
    name: string;
    status?: string;
    start_time: string;
    end_time: string;
    event_type: string;
    location?: {
        type: string;
        location?: string;
        join_url?: string;
    };
    invitees_counter?: {
        total: number;
        active: number;
        limit: number;
    };
    created_at: string;
    updated_at: string;
}

export class CalendlyWebhookPayload {
    event: string;
    time: string;
    payload: {
        event_type: string;
        event: CalendlyEvent;
        invitee: CalendlyInvitee;
        questions_and_answers?: QuestionAnswer[];
        tracking?: {
            utm_campaign?: string;
            utm_source?: string;
            utm_medium?: string;
            utm_content?: string;
            utm_term?: string;
        };
        old_event?: CalendlyEvent;
        old_invitee?: CalendlyInvitee;
        new_event?: CalendlyEvent;
        new_invitee?: CalendlyInvitee;
    };
}

export class CalendlyWebhookDto {
    @IsString()
    event: string;

    @IsObject()
    payload: CalendlyWebhookPayload['payload'];
}

export class UpdateCalendlyConfigDto {
    @IsString()
    calendlyUsername: string;

    @IsArray()
    eventTypes: Array<{
        name: string;
        url: string;
        duration: number;
        targetRole: string;
    }>;
}

export class GetBookingLinkDto {
    @IsString()
    mentorId: string;

    @IsOptional()
    @IsString()
    targetRole?: string;
}
