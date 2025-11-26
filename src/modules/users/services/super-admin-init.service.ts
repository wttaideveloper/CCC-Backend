import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User } from '../schemas/user.schema';
import { ROLES } from '../../../common/constants/roles.constants';
import { USER_STATUSES } from '../../../common/constants/status.constants';
import { hashPassword } from '../../../common/utils/bcrypt.util';

@Injectable()
export class SuperAdminInitService implements OnModuleInit {
    private readonly logger = new Logger(SuperAdminInitService.name);

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<User>,
        private readonly configService: ConfigService,
    ) {}

    async onModuleInit() {
        await this.ensureSuperAdminExists();
    }

    private async ensureSuperAdminExists(): Promise<void> {
        try {
            const email = this.configService.get<string>('superAdmin.email');
            const password = this.configService.get<string>('superAdmin.password');

            if (!email || !password) {
                this.logger.warn(
                    'Super Admin credentials not configured in .env (SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD) - skipping auto-creation'
                );
                return;
            }

            const existingSuperAdmin = await this.userModel
                .findOne({ role: ROLES.SUPER_ADMIN })
                .select('email')
                .lean()
                .exec();

            if (existingSuperAdmin) {
                this.logger.log(`Super Admin already exists: ${existingSuperAdmin.email}`);
                return;
            }

            const existingUser = await this.userModel
                .findOne({ email })
                .select('email role')
                .lean()
                .exec();

            if (existingUser) {
                this.logger.warn(
                    `Email "${email}" is already used by another user (role: ${existingUser.role}) - cannot create Super Admin`
                );
                return;
            }

            const hashedPassword = await hashPassword(password);

            await this.userModel.create({
                firstName: 'Super',
                lastName: 'Admin',
                email,
                password: hashedPassword,
                role: ROLES.SUPER_ADMIN,
                status: USER_STATUSES.ACCEPTED,
                isEmailVerified: true,
                hasCompleted: false,
                hasIssuedCertificate: false,
                assignedId: [],
                uploadedDocuments: [],
            });

            this.logger.log(`Super Admin created successfully: ${email}`);
        } catch (error) {
            this.logger.error('Failed to initialize Super Admin:', error);
        }
    }
}
