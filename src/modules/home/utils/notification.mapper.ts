import { NotificationResponseDto } from "../dto/notification.dto";
import { NotificationDocument } from "../schemas/notification.schema";

export function mapToResponse(doc: NotificationDocument | any): NotificationResponseDto {
    return {
        _id: doc._id.toString(),
        userId: doc.userId,
        role: doc.role,
        notifications: doc.notifications?.map((n: any) => ({
            name: n.name,
            details: n.details,
            module: n.module,
        })) || [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
