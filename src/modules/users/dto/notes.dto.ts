import { IsString, IsNotEmpty } from 'class-validator';

export class CreateNoteDto {
    @IsString()
    @IsNotEmpty()
    content: string;
}

export class UpdateNoteDto {
    @IsString()
    @IsNotEmpty()
    content: string;
}

export class NoteResponseDto {
    _id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}
