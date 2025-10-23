import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string, string> {

    /**
     * Transforms the value.
     * Checks if the incoming string is a valid MongoDB ObjectId.
     *
     * @param value The value to transform (the ID from the param).
     * @param metadata The argument metadata.
     * @returns The validated string.
     * @throws {BadRequestException} If the string is not a valid ObjectId.
     */
    transform(value: string, metadata: ArgumentMetadata): string {
        if (!Types.ObjectId.isValid(value)) {
            throw new BadRequestException(`'${value}' is not a valid MongoDB ObjectId`);
        }
        return value;
    }
}