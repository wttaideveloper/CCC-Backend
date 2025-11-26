import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    InterestFormFields,
    InterestFormFieldsDocument,
    DynamicField,
} from '../schemas/interest-form-fields.schema';
import {
    DynamicFieldDto,
    DynamicFieldResponseDto,
    StaticFieldResponseDto,
    InterestFormFieldsResponseDto,
    DynamicFieldsConfigResponseDto,
} from '../dto/interest-form-fields.dto';
import {
    TITLES_LIST,
    COUNTRIES_STATES_LIST,
    INTERESTS_LIST,
} from '../../../shared/constants/metadata.constants';

@Injectable()
export class InterestFormFieldsService {
    constructor(
        @InjectModel(InterestFormFields.name)
        private readonly formFieldsModel: Model<InterestFormFieldsDocument>,
    ) {}

    // Define static fields from the existing Interest schema
    private getStaticFields(): StaticFieldResponseDto[] {
        return [
            // Personal Information
            {
                fieldId: 'firstName',
                label: 'First Name',
                type: 'text_field',
                required: true,
                section: 'Personal Information',
            },
            {
                fieldId: 'lastName',
                label: 'Last Name',
                type: 'text_field',
                required: true,
                section: 'Personal Information',
            },
            {
                fieldId: 'email',
                label: 'Email',
                type: 'email',
                required: true,
                section: 'Personal Information',
            },
            {
                fieldId: 'phoneNumber',
                label: 'Phone Number',
                type: 'phone',
                required: true,
                section: 'Personal Information',
            },
            {
                fieldId: 'title',
                label: 'Title',
                type: 'select',
                required: false,
                section: 'Personal Information',
                options: TITLES_LIST,
            },
            {
                fieldId: 'profilePicture',
                label: 'Profile Picture',
                type: 'text_field',
                required: false,
                section: 'Personal Information',
            },
            {
                fieldId: 'profileInfo',
                label: 'Profile Info',
                type: 'text_area',
                required: false,
                section: 'Personal Information',
            },
            // Church Details
            {
                fieldId: 'churchDetails.churchName',
                label: 'Church Name',
                type: 'text_field',
                required: true,
                section: 'Church Details',
            },
            {
                fieldId: 'churchDetails.churchPhone',
                label: 'Church Phone',
                type: 'phone',
                required: false,
                section: 'Church Details',
            },
            {
                fieldId: 'churchDetails.churchWebsite',
                label: 'Church Website',
                type: 'text_field',
                required: false,
                section: 'Church Details',
            },
            {
                fieldId: 'churchDetails.churchAddress',
                label: 'Church Address',
                type: 'text_field',
                required: false,
                section: 'Church Details',
            },
            {
                fieldId: 'churchDetails.city',
                label: 'City',
                type: 'text_field',
                required: false,
                section: 'Church Details',
            },
            {
                fieldId: 'churchDetails.state',
                label: 'State',
                type: 'select',
                required: false,
                section: 'Church Details',
            },
            {
                fieldId: 'churchDetails.zipCode',
                label: 'Zip Code',
                type: 'text_field',
                required: false,
                section: 'Church Details',
            },
            {
                fieldId: 'churchDetails.country',
                label: 'Country',
                type: 'select',
                required: false,
                section: 'Church Details',
            },
            // Ministry Information
            {
                fieldId: 'conference',
                label: 'Conference',
                type: 'text_field',
                required: false,
                section: 'Ministry Information',
            },
            {
                fieldId: 'yearsInMinistry',
                label: 'Years in Ministry',
                type: 'text_field',
                required: false,
                section: 'Ministry Information',
            },
            {
                fieldId: 'currentCommunityProjects',
                label: 'Current Community Projects',
                type: 'text_area',
                required: false,
                section: 'Ministry Information',
            },
            {
                fieldId: 'interests',
                label: 'Interests',
                type: 'checkbox',
                required: false,
                section: 'Ministry Information',
                options: INTERESTS_LIST,
            },
            {
                fieldId: 'comments',
                label: 'Comments',
                type: 'text_area',
                required: false,
                section: 'Ministry Information',
            },
        ];
    }

    private async getOrCreateConfig(): Promise<InterestFormFieldsDocument> {
        let config = await this.formFieldsModel.findOne().exec();
        if (!config) {
            config = await this.formFieldsModel.create({ fields: [] });
        }
        return config;
    }

    async getFormFields(): Promise<InterestFormFieldsResponseDto> {
        const config = await this.getOrCreateConfig();
        const countriesList = COUNTRIES_STATES_LIST.map((item) => item.country);

        return {
            staticFields: this.getStaticFields(),
            dynamicFields: config.fields.map((field) => this.toFieldResponseDto(field)),
            metadata: {
                titles: TITLES_LIST,
                countries: countriesList,
                countryStates: COUNTRIES_STATES_LIST,
                interests: INTERESTS_LIST,
            },
        };
    }

    async getDynamicFieldsConfig(): Promise<DynamicFieldsConfigResponseDto> {
        const config = await this.getOrCreateConfig();
        return {
            _id: config._id.toString(),
            fields: config.fields.map((field) => this.toFieldResponseDto(field)),
            updatedAt: (config as any).updatedAt,
        };
    }

    async addField(
        fieldDto: DynamicFieldDto,
        userId?: Types.ObjectId,
    ): Promise<DynamicFieldsConfigResponseDto> {
        const config = await this.getOrCreateConfig();

        const existingField = config.fields.find(
            (f) => f.fieldId === fieldDto.fieldId,
        );
        if (existingField) {
            throw new BadRequestException(
                `Field with ID "${fieldDto.fieldId}" already exists`,
            );
        }

        const newField: DynamicField = {
            fieldId: fieldDto.fieldId,
            label: fieldDto.label,
            type: fieldDto.type,
            placeholder: fieldDto.placeholder,
            required: fieldDto.required ?? false,
            options: fieldDto.options ?? [],
            order: fieldDto.order ?? config.fields.length,
            section: fieldDto.section,
        };

        config.fields.push(newField);
        config.updatedBy = userId;
        await config.save();

        return {
            _id: config._id.toString(),
            fields: config.fields.map((field) => this.toFieldResponseDto(field)),
            updatedAt: (config as any).updatedAt,
        };
    }

    async updateField(
        fieldId: string,
        fieldDto: Partial<DynamicFieldDto>,
        userId?: Types.ObjectId,
    ): Promise<DynamicFieldsConfigResponseDto> {
        const config = await this.getOrCreateConfig();

        const fieldIndex = config.fields.findIndex((f) => f.fieldId === fieldId);
        if (fieldIndex === -1) {
            throw new NotFoundException(`Field with ID "${fieldId}" not found`);
        }

        const existingField = config.fields[fieldIndex];
        config.fields[fieldIndex] = {
            ...existingField,
            ...fieldDto,
            fieldId: existingField.fieldId,
        } as DynamicField;

        config.updatedBy = userId;
        await config.save();

        return {
            _id: config._id.toString(),
            fields: config.fields.map((field) => this.toFieldResponseDto(field)),
            updatedAt: (config as any).updatedAt,
        };
    }

    async removeField(
        fieldId: string,
        userId?: Types.ObjectId,
    ): Promise<DynamicFieldsConfigResponseDto> {
        const config = await this.getOrCreateConfig();

        const fieldIndex = config.fields.findIndex((f) => f.fieldId === fieldId);
        if (fieldIndex === -1) {
            throw new NotFoundException(`Field with ID "${fieldId}" not found`);
        }

        config.fields.splice(fieldIndex, 1);
        config.updatedBy = userId;
        await config.save();

        return {
            _id: config._id.toString(),
            fields: config.fields.map((field) => this.toFieldResponseDto(field)),
            updatedAt: (config as any).updatedAt,
        };
    }

    async replaceAllFields(
        fields: DynamicFieldDto[],
        userId?: Types.ObjectId,
    ): Promise<DynamicFieldsConfigResponseDto> {
        const config = await this.getOrCreateConfig();

        const fieldIds = fields.map((f) => f.fieldId);
        const uniqueFieldIds = new Set(fieldIds);
        if (fieldIds.length !== uniqueFieldIds.size) {
            throw new BadRequestException('Duplicate fieldIds found in the input');
        }

        config.fields = fields.map((fieldDto, index) => ({
            fieldId: fieldDto.fieldId,
            label: fieldDto.label,
            type: fieldDto.type,
            placeholder: fieldDto.placeholder,
            required: fieldDto.required ?? false,
            options: fieldDto.options ?? [],
            order: fieldDto.order ?? index,
            section: fieldDto.section,
        }));

        config.updatedBy = userId;
        await config.save();

        return {
            _id: config._id.toString(),
            fields: config.fields.map((field) => this.toFieldResponseDto(field)),
            updatedAt: (config as any).updatedAt,
        };
    }

    async reorderFields(
        fieldIds: string[],
        userId?: Types.ObjectId,
    ): Promise<DynamicFieldsConfigResponseDto> {
        const config = await this.getOrCreateConfig();

        const existingFieldIds = new Set(config.fields.map((f) => f.fieldId));
        for (const fieldId of fieldIds) {
            if (!existingFieldIds.has(fieldId)) {
                throw new NotFoundException(`Field with ID "${fieldId}" not found`);
            }
        }

        const reorderedFields: DynamicField[] = [];
        for (let i = 0; i < fieldIds.length; i++) {
            const field = config.fields.find((f) => f.fieldId === fieldIds[i]);
            if (field) {
                field.order = i;
                reorderedFields.push(field);
            }
        }

        config.fields = reorderedFields;
        config.updatedBy = userId;
        await config.save();

        return {
            _id: config._id.toString(),
            fields: config.fields.map((field) => this.toFieldResponseDto(field)),
            updatedAt: (config as any).updatedAt,
        };
    }

    private toFieldResponseDto(field: DynamicField): DynamicFieldResponseDto {
        return {
            fieldId: field.fieldId,
            label: field.label,
            type: field.type,
            placeholder: field.placeholder,
            required: field.required,
            options: field.options,
            order: field.order,
            section: field.section,
        };
    }
}
