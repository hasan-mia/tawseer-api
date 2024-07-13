import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ImageUploadOptions } from './imageupload.provider';

@Module({
  imports: [MulterModule.register(ImageUploadOptions)],
  exports: [MulterModule],
})
export class FileUploadModule {}
