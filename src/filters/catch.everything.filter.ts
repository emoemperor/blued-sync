import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    console.log('CatchEverythingFilter', exception);
  }
}
