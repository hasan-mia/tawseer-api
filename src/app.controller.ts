/* eslint-disable prettier/prettier */
import { Controller, Get, InternalServerErrorException, Res } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('/')
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('send')
  sendMailer(@Res() response: any) {
    const options = {
      email: 'hasanrafi69@gmail.com',
      name: 'Tawseer',
      subject: 'Test Email',
      message: 'Test Email'
    };
    try {
      this.appService.sendOtp(options);

      return response.status(200).json({
        message: 'success',
      });
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
