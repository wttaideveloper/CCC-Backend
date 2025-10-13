import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Home, HomeDocument } from "./schemas/home.schema";
import { HomeResponseDto } from "./dto/home-response.dto";
import { toHomeResponseDto } from "./utils/home.mapper";
import { UsersService } from "../users/users.service";


@Injectable()
export class HomeService {
    constructor(
        @InjectModel(Home.name)
        private readonly homeModel: Model<HomeDocument>,
        private readonly userService: UsersService
    ) { }

    async getByEmail(email: string): Promise<HomeResponseDto> {
        const home = await this.homeModel.findOne({ email }).exec();

        if (!home) {
            throw new NotFoundException(`Home data not found for email: ${email}`);
        }
        return toHomeResponseDto(home);
    }

    // async getMentors(): Promise<MentorDto> {
    //     const mentors = await this.userService.findByRole('mentor');

    //     if (!mentors) throw new NotFoundException(`Mentors data not found`);

    //     return mentors.map(mentor => toMentorResponseDto(mentor))
    // }

    // async getVideos(email: string): Promise<HomeVideoDto> {

    // }
}