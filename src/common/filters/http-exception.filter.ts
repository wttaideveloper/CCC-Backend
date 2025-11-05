import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService,
  ) { }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
      } else {
        message = exceptionResponse as string;
      }
    }

    // Log error with details
    const errorLog = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      status,
      message,
      user: (request as any).user?.userId || 'anonymous',
    };

    if (status >= 500) {
      this.logger.error(
        `[${status}] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : JSON.stringify(errorLog),
      );
    } else {
      this.logger.warn(
        `[${status}] ${request.method} ${request.url} - ${exception instanceof Error ? exception.message : 'Unknown error'
        }`,
      );
    }

    // Send response
    const nodeEnv = this.configService?.get<string>('nodeEnv') || process.env.NODE_ENV || 'production';

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
      // Only include stack trace in development
      ...(nodeEnv === 'development' && exception instanceof Error
        ? { stack: exception.stack }
        : {}),
    });
  }
}
