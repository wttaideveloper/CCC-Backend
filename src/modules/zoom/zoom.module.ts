import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ZoomService } from './zoom.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [ZoomService],
    exports: [ZoomService],
})
export class ZoomModule {}
