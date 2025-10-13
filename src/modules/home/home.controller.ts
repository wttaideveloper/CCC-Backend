import { Controller, Get, Param } from "@nestjs/common";
import { BaseResponse } from "src/shared/interfaces/base-response.interface";
import { HomeService } from "./home.service";
import { HomeResponseDto } from "./dto/home-response.dto";


@Controller('home')
export class HomeController {
    constructor(private readonly homeService: HomeService) { }

    // @Get('mentors')
    // async getMentors(): Promise<BaseResponse<MentorDto>> {
    //     const mentors = await this.homeService.getMentors();

    //     return {
    //         success: true,
    //         message: 'Home details fetched successfully',
    //         data: mentors
    //     };

    // }

    @Get(':email')
    async getHomeDetails(@Param('email') email: string): Promise<BaseResponse<HomeResponseDto>> {
        const home = await this.homeService.getByEmail(email);
        return {
            success: true,
            message: 'Home details fetched successfully',
            data: home
        };
    }

    // @Get('video/:email')
    // async getHomeVideos(@Param('email') email: string): Promise<BaseResponse<HomeVideoDto>> {
    //     const videos = await this.homeService.getVideos(email);
    //     return {
    //         success: true,
    //         message: 'Home videos fetched successfully',
    //         data: videos
    //     };
    // }
} 