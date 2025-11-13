import { Types } from 'mongoose';

export const toObjectId = (
    id: string | Types.ObjectId | null | undefined
): Types.ObjectId | null => {
    if (!id) {
        return null;
    }

    if (id instanceof Types.ObjectId) {
        return id;
    }

    if (typeof id === 'string' && Types.ObjectId.isValid(id)) {
        return new Types.ObjectId(id);
    }

    return null;
};