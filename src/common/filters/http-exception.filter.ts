import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  Optional,
  BadRequestException,
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

    // Handle HTTP exceptions (thrown by NestJS or manually)
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
    // Handle MongoDB/Mongoose errors
    else if (this.isMongoError(exception)) {
      const mongoError = this.handleMongoError(exception as any);
      status = mongoError.status;
      message = mongoError.message;
      error = mongoError.error;
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      message = exception.message || 'An unexpected error occurred';
      error = exception.name || 'Error';
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

  /**
   * Check if error is a MongoDB/Mongoose error
   */
  private isMongoError(exception: any): boolean {
    return (
      exception.name === 'MongoError' ||
      exception.name === 'MongoServerError' ||
      exception.name === 'ValidationError' ||
      exception.name === 'CastError' ||
      exception.name === 'DocumentNotFoundError' ||
      exception.code === 11000 ||
      exception.code === 11001
    );
  }

  /**
   * Handle MongoDB/Mongoose specific errors
   */
  private handleMongoError(exception: any): { status: number; message: string | string[]; error: string } {
    // Duplicate key error
    if (exception.code === 11000 || exception.code === 11001) {
      const field = Object.keys(exception.keyPattern || {})[0] || 'field';
      const value = exception.keyValue?.[field] || 'unknown';
      return {
        status: HttpStatus.CONFLICT,
        message: `Duplicate value for ${field}: '${value}' already exists`,
        error: 'Duplicate Key Error',
      };
    }

    // Validation error
    if (exception.name === 'ValidationError') {
      const messages = Object.values(exception.errors || {}).map((err: any) => err.message);
      return {
        status: HttpStatus.BAD_REQUEST,
        message: messages.length > 0 ? messages : 'Validation failed',
        error: 'Validation Error',
      };
    }

    // Cast error (invalid ObjectId, etc.)
    if (exception.name === 'CastError') {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `Invalid ${exception.kind || 'value'} for ${exception.path}: '${exception.value}'`,
        error: 'Cast Error',
      };
    }

    // Document not found
    if (exception.name === 'DocumentNotFoundError') {
      return {
        status: HttpStatus.NOT_FOUND,
        message: 'Document not found',
        error: 'Not Found',
      };
    }

    // Generic MongoDB error
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception.message || 'Database error occurred',
      error: 'Database Error',
    };
  }
}
