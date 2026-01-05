import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RoadMap } from '../roadmaps/schemas/roadmap.schema';
import { Appointment } from '../appointments/schemas/appointment.schema';
import { Assessment } from '../assessment/schemas/assessment.schema';
import { User } from '../users/schemas/user.schema';
import { Interest } from '../interests/schemas/interest.schema';
import { Scholarship } from '../products_services/schemas/scholarship.schema';
import { MicroGrantApplication } from '../micro-grand/schemas/micro-grant-application.schema';
import { Progress } from '../progress/schemas/progress.schema';
import { SearchQueryDto, SearchModule } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { SearchResultItem, SearchStats } from './interfaces/search-result.interface';
import { ROLES } from '../../common/constants/roles.constants';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectModel(RoadMap.name) private roadMapModel: Model<RoadMap>,
    @InjectModel(Appointment.name) private appointmentModel: Model<Appointment>,
    @InjectModel(Assessment.name) private assessmentModel: Model<Assessment>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Interest.name) private interestModel: Model<Interest>,
    @InjectModel(Scholarship.name) private scholarshipModel: Model<Scholarship>,
    @InjectModel(MicroGrantApplication.name)
    private microGrantModel: Model<MicroGrantApplication>,
    @InjectModel(Progress.name) private progressModel: Model<Progress>,
  ) { }

  async globalSearch(
    query: SearchQueryDto,
    user: any,
  ): Promise<SearchResponseDto> {
    const startTime = Date.now();

    try {
      const { query: keyword, modules, page = 1, limit = 20, sortBy = 'relevance' } = query;

      const sanitizedKeyword = this.sanitizeSearchKeyword(keyword);

      const requestedModules = modules || [SearchModule.ALL];
      const modulesToSearch = this.getModulesToSearch(requestedModules, user);

      this.logger.log(
        `Global search initiated by user ${user._id} (${user.role}) for keyword: "${keyword}" | ` +
        `Requested modules: [${requestedModules.join(', ')}] | ` +
        `Accessible modules: [${modulesToSearch.join(', ')}]`,
      );

      const filteredModules = requestedModules.filter(
        m => m !== SearchModule.ALL && !modulesToSearch.includes(m)
      );
      if (filteredModules.length > 0) {
        this.logger.warn(
          `Access denied for user ${user._id} (${user.role}) to modules: [${filteredModules.join(', ')}]`
        );
      }

      // Execute parallel searches across all modules
      const searchPromises = modulesToSearch.map((module) =>
        this.searchModule(module, sanitizedKeyword, user).catch((error) => {
          this.logger.error(`Error searching ${module}:`, error);
          return [];
        }),
      );

      const searchResults = await Promise.all(searchPromises);

      const groupedResults: Record<string, any[]> = {};
      let totalResults = 0;

      searchResults.forEach((moduleResults) => {
        if (moduleResults.length > 0) {
          const moduleName = moduleResults[0].module;

          const sortedResults = this.sortResults(moduleResults, sortBy || 'relevance');

          groupedResults[moduleName] = sortedResults;
          totalResults += moduleResults.length;
        }
      });

      // Calculate stats
      const moduleBreakdown = this.calculateModuleBreakdown(searchResults.flat());
      const searchTime = Date.now() - startTime;

      const stats: SearchStats = {
        totalResults,
        searchTime,
        moduleBreakdown,
      };

      this.logger.log(
        `Search completed in ${searchTime}ms. Found ${totalResults} results across ${Object.keys(moduleBreakdown).length} modules`,
      );

      return {
        success: true,
        message: 'Search completed successfully',
        data: {
          results: groupedResults,
          total: totalResults,
          page,
          limit,
          searchQuery: keyword,
          stats,
        },
      };
    } catch (error) {
      this.logger.error('Global search error:', error);
      throw error;
    }
  }

  private async searchModule(
    module: SearchModule,
    keyword: string,
    user: any,
  ): Promise<SearchResultItem[]> {
    switch (module) {
      case SearchModule.ROADMAPS:
        return this.searchRoadmaps(keyword, user);
      case SearchModule.APPOINTMENTS:
        return this.searchAppointments(keyword, user);
      case SearchModule.ASSESSMENTS:
        return this.searchAssessments(keyword, user);
      case SearchModule.USERS:
        return this.searchUsers(keyword, user);
      case SearchModule.INTERESTS:
        return this.searchInterests(keyword, user);
      case SearchModule.SCHOLARSHIPS:
        return this.searchScholarships(keyword, user);
      case SearchModule.MICRO_GRANTS:
        return this.searchMicroGrants(keyword, user);
      default:
        return [];
    }
  }

  private async searchRoadmaps(
    keyword: string,
    user: any,
  ): Promise<SearchResultItem[]> {
    try {
      let assignedRoadmapIds: any[] = [];

      if (!this.canAccessAllRoadmaps(user.role)) {
        const userProgress = await this.progressModel
          .findOne({ userId: user._id })
          .select('roadmaps.roadMapId')
          .lean()
          .exec();

        if (!userProgress || !userProgress.roadmaps || userProgress.roadmaps.length === 0) {
          return [];
        }

        assignedRoadmapIds = userProgress.roadmaps.map((r: any) => r.roadMapId);
      }

      const pipeline: any[] = [];

      // Stage 1: Use optimized search conditions
      const searchFields = ['name', 'description', 'roadMapDetails'];
      const searchConditions = this.buildOptimizedSearchConditions(keyword, searchFields);

      pipeline.push({
        $match: {
          $or: searchConditions
        }
      });

      // Stage 2: Filter by assigned roadmaps for non-admins
      if (assignedRoadmapIds.length > 0) {
        pipeline.push({
          $match: {
            _id: { $in: assignedRoadmapIds }
          }
        });
      }

      pipeline.push(
        { $limit: 50 },
        {
          $project: {
            name: 1,
            description: 1,
            roadMapDetails: 1,
            type: 1,
            status: 1,
            duration: 1,
            phase: 1,
            createdAt: 1,
            imageUrl: 1,
            roadmaps: 1,
          }
        },
        {
          $sort: { createdAt: -1 }
        }
      );

      const results = await this.roadMapModel.aggregate(pipeline).exec();

      const searchResults: SearchResultItem[] = [];

      results.forEach((roadmap: any) => {
        searchResults.push({
          id: roadmap._id.toString(),
          module: 'roadmaps',
          title: roadmap.name,
          description: roadmap.description,
          metadata: {
            type: roadmap.type,
            status: roadmap.status,
            duration: roadmap.duration,
            roadMapDetails: roadmap.roadMapDetails,
            imageUrl: roadmap.imageUrl,
            isParent: true,
            hasNestedRoadmaps: roadmap.roadmaps?.length > 0,
            nestedCount: roadmap.roadmaps?.length || 0,
            ...this.getSearchMetadata(),
          },
          createdAt: roadmap.createdAt as Date,
          matchedFields: this.getMatchedFields(roadmap, keyword, searchFields),
        });

        // Check if any nested roadmaps match
        if (roadmap.roadmaps && roadmap.roadmaps.length > 0) {
          roadmap.roadmaps.forEach((nested: any, index: number) => {
            const nestedMatches = this.getMatchedFields(nested, keyword, searchFields);

            if (nestedMatches.length > 0) {
              searchResults.push({
                id: nested._id?.toString() || `${roadmap._id.toString()}-nested-${index}`,
                module: 'roadmaps',
                title: nested.name,
                description: nested.description,
                metadata: {
                  status: nested.status,
                  duration: nested.duration,
                  roadMapDetails: nested.roadMapDetails,
                  imageUrl: nested.imageUrl,
                  isNested: true,
                  parentRoadmapId: roadmap._id.toString(),
                  parentRoadmapName: roadmap.name,
                  ...this.getSearchMetadata(),
                },
                createdAt: nested.completedOn || roadmap.createdAt as Date,
                matchedFields: nestedMatches,
              });
            }
          });
        }
      });

      return searchResults;
    } catch (error) {
      this.logger.error('Error searching roadmaps:', error);
      return [];
    }
  }

  private async searchAppointments(
    keyword: string,
    user: any,
  ): Promise<SearchResultItem[]> {
    try {
      const baseQuery: any = {};

      const searchFields = ['platform', 'status', 'notes'];
      baseQuery.$or = this.buildOptimizedSearchConditions(keyword, searchFields);

      if (this.canAccessAllAppointments(user.role)) {
      } else if (this.isMentor(user.role)) {
        const roleFilter = [
          { mentorId: user._id },
          { userId: user._id },
        ];

        const searchConditions = baseQuery.$or;
        baseQuery.$and = [
          { $or: searchConditions },
          { $or: roleFilter },
        ];
        delete baseQuery.$or;
      } else {
        baseQuery.userId = user._id;
      }

      const results = await this.appointmentModel
        .find(baseQuery)
        .populate('userId', 'firstName lastName email')
        .populate('mentorId', 'firstName lastName email')
        .select('meetingDate endTime platform status notes createdAt')
        .sort({ meetingDate: -1 })
        .limit(50)
        .lean()
        .exec();

      return results.map((appointment: any) => ({
        id: appointment._id.toString(),
        module: 'appointments',
        title: `Appointment on ${new Date(appointment.meetingDate).toLocaleDateString()}`,
        description: `${appointment.platform} - ${appointment.status}`,
        metadata: {
          meetingDate: appointment.meetingDate,
          endTime: appointment.endTime,
          platform: appointment.platform,
          status: appointment.status,
          user: appointment.userId
            ? `${appointment.userId.firstName} ${appointment.userId.lastName}`
            : null,
          mentor: appointment.mentorId
            ? `${appointment.mentorId.firstName} ${appointment.mentorId.lastName}`
            : null,
          ...this.getSearchMetadata(),
        },
        createdAt: appointment.createdAt,
        matchedFields: this.getMatchedFields(appointment, keyword, searchFields),
      }));
    } catch (error) {
      this.logger.error('Error searching appointments:', error);
      return [];
    }
  }

  private async searchAssessments(
    keyword: string,
    user: any,
  ): Promise<SearchResultItem[]> {
    try {
      const baseQuery: any = {};

      const searchFields = ['name', 'description', 'type'];
      baseQuery.$or = this.buildOptimizedSearchConditions(keyword, searchFields);

      if (!this.canAccessAllAssessments(user.role)) {
        baseQuery['assignments.userId'] = user._id;
      }

      const results = await this.assessmentModel
        .find(baseQuery)
        .select('name description type assignments createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec();

      return results.map((assessment: any) => {
        const userAssignment = assessment.assignments?.find(
          (a: any) => a.userId?.toString() === user._id.toString(),
        );

        return {
          id: assessment._id.toString(),
          module: 'assessments',
          title: assessment.name,
          description: assessment.description,
          metadata: {
            type: assessment.type,
            assignedStatus: userAssignment?.status || 'not-assigned',
            assignedDate: userAssignment?.assignedAt,
            ...this.getSearchMetadata(),
          },
          createdAt: assessment.createdAt as Date,
          matchedFields: this.getMatchedFields(assessment, keyword, searchFields),
        };
      });
    } catch (error) {
      this.logger.error('Error searching assessments:', error);
      return [];
    }
  }

  private async searchUsers(
    keyword: string,
    user: any,
  ): Promise<SearchResultItem[]> {
    try {
      const baseQuery: any = {
        status: 'accepted', // Only show accepted users
      };

      const searchFields = ['firstName', 'lastName', 'email', 'username'];
      baseQuery.$or = this.buildOptimizedSearchConditions(keyword, searchFields);

      if (this.canAccessAllUsers(user.role)) {
      } else if (this.isMentor(user.role)) {
        baseQuery.assignedId = user._id;
      } else {
        baseQuery._id = user._id;
      }

      const results = await this.userModel
        .find(baseQuery)
        .select(
          'firstName lastName email username role status profilePicture createdAt',
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec();

      return results.map((foundUser: any) => ({
        id: foundUser._id.toString(),
        module: 'users',
        title: `${foundUser.firstName} ${foundUser.lastName}`,
        description: foundUser.email,
        metadata: {
          role: foundUser.role,
          status: foundUser.status,
          username: foundUser.username,
          profilePicture: foundUser.profilePicture,
          ...this.getSearchMetadata(),
        },
        createdAt: foundUser.createdAt as Date,
        matchedFields: this.getMatchedFields(foundUser, keyword, searchFields),
      }));
    } catch (error) {
      this.logger.error('Error searching users:', error);
      return [];
    }
  }

  private async searchInterests(
    keyword: string,
    user: any,
  ): Promise<SearchResultItem[]> {
    try {
      const baseQuery: any = {};

      const searchFields = ['firstName', 'lastName', 'email', 'title', 'conference'];
      baseQuery.$or = this.buildOptimizedSearchConditions(keyword, searchFields);

      if (!this.canAccessAllInterests(user.role)) {
        baseQuery.email = user.email;
      }

      const results = await this.interestModel
        .find(baseQuery)
        .select('firstName lastName email phoneNumber title conference status yearsInMinistry churchDetails createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec();

      return results.map((interest: any) => ({
        id: interest._id.toString(),
        module: 'interests',
        title: `${interest.firstName} ${interest.lastName} - ${interest.title}`,
        description: `${interest.email}${interest.conference ? ' - ' + interest.conference : ''}`,
        metadata: {
          status: interest.status,
          conference: interest.conference,
          title: interest.title,
          phoneNumber: interest.phoneNumber,
          yearsInMinistry: interest.yearsInMinistry,
          churchName: interest.churchDetails?.[0]?.churchName,
          city: interest.churchDetails?.[0]?.city,
          state: interest.churchDetails?.[0]?.state,
          ...this.getSearchMetadata(),
        },
        createdAt: interest.createdAt as Date,
        matchedFields: this.getMatchedFields(interest, keyword, searchFields),
      }));
    } catch (error) {
      this.logger.error('Error searching interests:', error);
      return [];
    }
  }

  private async searchScholarships(
    keyword: string,
    _user: any,
  ): Promise<SearchResultItem[]> {
    try {
      const baseQuery: any = {
        status: 'active',
      };

      const searchFields = ['type', 'description'];
      baseQuery.$or = this.buildOptimizedSearchConditions(keyword, searchFields);

      const results = await this.scholarshipModel
        .find(baseQuery)
        .select('type description amount status createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec();

      return results.map((scholarship: any) => ({
        id: scholarship._id.toString(),
        module: 'scholarships',
        title: scholarship.type,
        description: scholarship.description,
        metadata: {
          amount: scholarship.amount,
          status: scholarship.status,
          ...this.getSearchMetadata(),
        },
        createdAt: scholarship.createdAt as Date,
        matchedFields: this.getMatchedFields(scholarship, keyword, searchFields),
      }));
    } catch (error) {
      this.logger.error('Error searching scholarships:', error);
      return [];
    }
  }

  private async searchMicroGrants(
    keyword: string,
    user: any,
  ): Promise<SearchResultItem[]> {
    try {
      const baseQuery: any = {};

      const prefixRegex = new RegExp(`^${keyword}`, 'i');
      const wordBoundaryRegex = new RegExp(`\\b${keyword}`, 'i');

      // Common field names in micro-grant applications with optimized search
      const searchConditions: any[] = [];
      const answerFields = [
        'Church Name',
        'Purpose of Grant',
        'Project Title',
        'Project Description',
        'Project Name',
        'Description',
      ];

      answerFields.forEach(field => {
        if (keyword.length <= 2) {
          searchConditions.push({ [`answers.${field}`]: prefixRegex });
        } else {
          searchConditions.push(
            { [`answers.${field}`]: prefixRegex },
            { [`answers.${field}`]: wordBoundaryRegex },
          );
        }
      });

      baseQuery.$or = searchConditions;

      if (!this.canAccessAllMicroGrants(user.role)) {
        baseQuery.userId = user._id;
      }

      const results = await this.microGrantModel
        .find(baseQuery)
        .populate('userId', 'firstName lastName email')
        .populate('formId', 'title')
        .select('answers status createdAt userId formId')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec();

      return results.map((grant: any) => {
        // Extract title and description from answers (try common field names)
        const title = grant.answers?.['Project Title'] ||
          grant.answers?.['Project Name'] ||
          grant.answers?.['Church Name'] ||
          grant.formId?.title ||
          'Micro Grant Application';

        const description = grant.answers?.['Project Description'] ||
          grant.answers?.['Purpose of Grant'] ||
          grant.answers?.['Description'] ||
          '';

        return {
          id: grant._id.toString(),
          module: 'micro-grants',
          title: title,
          description: description,
          metadata: {
            status: grant.status,
            formTitle: grant.formId?.title,
            applicant: grant.userId
              ? `${grant.userId.firstName} ${grant.userId.lastName}`
              : null,
            applicantEmail: grant.userId?.email,
            ...this.getSearchMetadata(),
          },
          createdAt: grant.createdAt,
          matchedFields: this.getMatchedFieldsFromAnswers(grant.answers, keyword),
        };
      });
    } catch (error) {
      this.logger.error('Error searching micro-grants:', error);
      return [];
    }
  }

  private getMatchedFieldsFromAnswers(answers: Record<string, any>, keyword: string): string[] {
    if (!answers) return [];

    const regex = new RegExp(keyword, 'i');
    const matched: string[] = [];

    Object.entries(answers).forEach(([key, value]) => {
      if (typeof value === 'string' && regex.test(value)) {
        matched.push(key);
      }
    });

    return matched;
  }

  private sanitizeSearchKeyword(keyword: string): string {
    return keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getModulesToSearch(
    requestedModules: SearchModule[],
    user: any,
  ): SearchModule[] {
    if (
      !requestedModules ||
      requestedModules.length === 0 ||
      requestedModules.includes(SearchModule.ALL)
    ) {
      const allModules: SearchModule[] = [
        SearchModule.ROADMAPS,
        SearchModule.APPOINTMENTS,
        SearchModule.ASSESSMENTS,
      ];

      if (this.canSearchUsers(user.role)) {
        allModules.push(SearchModule.USERS);
      }
      if (this.canSearchInterests(user.role)) {
        allModules.push(SearchModule.INTERESTS);
      }
      if (this.canSearchScholarships(user.role)) {
        allModules.push(SearchModule.SCHOLARSHIPS);
      }
      if (this.canSearchMicroGrants(user.role)) {
        allModules.push(SearchModule.MICRO_GRANTS);
      }

      return allModules;
    }

    return requestedModules.filter((module) => {
      switch (module) {
        case SearchModule.USERS:
          return this.canSearchUsers(user.role);
        case SearchModule.INTERESTS:
          return this.canSearchInterests(user.role);
        case SearchModule.SCHOLARSHIPS:
          return this.canSearchScholarships(user.role);
        case SearchModule.MICRO_GRANTS:
          return this.canSearchMicroGrants(user.role);
        case SearchModule.ROADMAPS:
        case SearchModule.APPOINTMENTS:
        case SearchModule.ASSESSMENTS:
          return true;
        default:
          return false;
      }
    });
  }

  private sortResults(
    results: SearchResultItem[],
    sortBy: string,
  ): SearchResultItem[] {
    switch (sortBy) {
      case 'date':
        return results.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      case 'name':
        return results.sort((a, b) => a.title.localeCompare(b.title));
      case 'relevance':
      default:
        return results.sort(
          (a, b) =>
            (b.matchedFields?.length || 0) - (a.matchedFields?.length || 0),
        );
    }
  }

  private calculateModuleBreakdown(
    results: SearchResultItem[],
  ): Record<string, number> {
    return results.reduce((acc, result) => {
      acc[result.module] = (acc[result.module] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getMatchedFields(
    document: any,
    keyword: string,
    fields: string[],
  ): string[] {
    const matched: string[] = [];
    const regex = new RegExp(keyword, 'i');

    fields.forEach((field) => {
      if (document[field] && regex.test(document[field])) {
        matched.push(field);
      }
    });

    return matched;
  }

  // ==================== ROLE-BASED ACCESS CONTROL HELPERS ====================

  private canAccessAllUsers(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.DIRECTOR;
  }

  private canSearchUsers(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.DIRECTOR;
  }

  private canAccessAllInterests(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.DIRECTOR;
  }

  private canSearchInterests(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.DIRECTOR;
  }

  private canSearchScholarships(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.DIRECTOR;
  }

  private canAccessAllMicroGrants(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.DIRECTOR;
  }

  private canSearchMicroGrants(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.DIRECTOR;
  }

  private canAccessAllRoadmaps(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.DIRECTOR;
  }

  private canAccessAllAppointments(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.DIRECTOR;
  }

  private canAccessAllAssessments(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.DIRECTOR;
  }

  private isMentor(role: string): boolean {
    return role === ROLES.MENTOR || role === ROLES.FIELD_MENTOR;
  }

  /**
   * Optimized search query builder - Smart hybrid search strategy
   * Uses prefix-based approach for better index utilization
   *
   * Strategy:
   * 1. Short queries (1-2 chars): Prefix-only for maximum performance
   * 2. Longer queries (3+ chars): Prefix + Word boundary for comprehensive matching
   *
   * Performance characteristics:
   * - Prefix regex (^keyword) can utilize MongoDB text indexes
   * - Word boundary (\bkeyword) catches mid-word matches efficiently
   * - Both patterns are optimized for case-insensitive search
   */
  private buildOptimizedSearchConditions(keyword: string, fields: string[]): any[] {
    // For very short queries (1-2 chars), use prefix only for performance
    if (keyword.length <= 2) {
      const prefixRegex = new RegExp(`^${keyword}`, 'i');
      return fields.map(field => ({ [field]: prefixRegex }));
    }

    // For longer queries, use smart hybrid approach
    // Prefix regex can utilize indexes better than unanchored regex
    const prefixRegex = new RegExp(`^${keyword}`, 'i');
    const wordBoundaryRegex = new RegExp(`\\b${keyword}`, 'i');

    const conditions: any[] = [];

    fields.forEach(field => {
      conditions.push(
        { [field]: prefixRegex },
        { [field]: wordBoundaryRegex },
      );
    });

    return conditions;
  }

  private getSearchMetadata(): any {
    return {};
  }
}
