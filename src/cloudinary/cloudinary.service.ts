import { Injectable } from '@nestjs/common';
import { UploadApiErrorResponse, UploadApiResponse, v2 } from 'cloudinary';
import toStream = require('buffer-to-stream');
@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const upload = v2.uploader.upload_stream((error, result) => {
        if (error) return reject(error);
        resolve(result);
      });

      toStream(file.buffer).pipe(upload);
    });
  }

  async uploadImages(
    files: Express.Multer.File[],
  ): Promise<(UploadApiResponse | UploadApiErrorResponse)[]> {
    const uploadPromises: Promise<
      UploadApiResponse | UploadApiErrorResponse
    >[] = [];

    for (const file of files) {
      const uploadPromise = new Promise<
        UploadApiResponse | UploadApiErrorResponse
      >((resolve, reject) => {
        const upload = v2.uploader.upload_stream((error, result) => {
          if (error) reject(error);
          else resolve(result);
        });

        toStream(file.buffer).pipe(upload);
      });

      uploadPromises.push(uploadPromise);
    }

    return Promise.all(uploadPromises);
  }
}
