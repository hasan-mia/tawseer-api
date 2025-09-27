/* eslint-disable prettier/prettier */
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Injectable } from '@nestjs/common';
import { UploadApiErrorResponse, UploadApiResponse, v2 } from 'cloudinary';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as streamifier from 'streamifier';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      // Check if file is an image
      const isImage = file.mimetype && file.mimetype.startsWith("image/");

      const uploadOptions = isImage
        ? {
          format: "webp",
          quality: "auto",
          fetch_format: "auto",
        }
        : {};

      const upload = v2.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("Upload failed - no result"));
          resolve(result);
        }
      );

      streamifier.createReadStream(file.buffer).pipe(upload);
    });
  }

  async uploadVideo(file: Express.Multer.File): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const upload = v2.uploader.upload_stream(
        {
          resource_type: 'video',
          eager: [
            { width: 640, height: 360, crop: "scale" },
            { width: 854, height: 480, crop: "scale" },
          ],
          eager_async: true,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(upload);
    });
  }

  async convertAndUploadVideo(file: Express.Multer.File): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(__dirname, '..', 'public', 'upload', 'video');
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const filePath = path.join(outputPath, file.originalname);
      const date = new Date();
      const name = date.toISOString().replace(/[:.-]/g, '');
      const outputDir = path.join(outputPath, name);
      const outputName = `${name}.m3u8`;

      fs.writeFileSync(filePath, file.buffer);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }

      ffmpeg(filePath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset slow',
          '-crf 28',
          '-b:a 128k',
          '-hls_segment_type fmp4',
          '-hls_time 10',
          '-hls_list_size 0',
        ])
        .output(path.join(outputDir, outputName))
        .on('end', async () => {
          fs.unlinkSync(filePath);
          fs.rmdirSync(outputPath, { recursive: true });
          try {
            const convertedFilePath = path.join(outputDir, outputName);
            console.log('Conversion complete!', convertedFilePath);

            const uploadStream = v2.uploader.upload_stream((error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            });

            fs.createReadStream(convertedFilePath).pipe(uploadStream);
          } catch (error) {
            console.error(error);
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error(err);
          reject(err);
        })
        .run();
    });
  }

  async deleteFile(publicId: string): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      v2.uploader.destroy(publicId, (error, result) => {
        console.log(publicId, result);
        if (error) return reject(error);
        resolve(result);
      });
    });
  }
}
