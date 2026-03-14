import { Injectable } from '@nestjs/common';
import { UploadApiErrorResponse, UploadApiResponse, v2 } from 'cloudinary';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as streamifier from 'streamifier';

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

  async convertAndUploadVideo(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const baseDir = path.join(__dirname, '..', 'public', 'upload', 'video');

      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }

      const date = new Date();
      const name = date.toISOString().replace(/[:.-]/g, '');

      const inputPath = path.join(baseDir, `${name}.mp4`);
      const outputDir = path.join(baseDir, name);
      const outputName = `${name}.m3u8`;
      const outputPath = path.join(outputDir, outputName);

      fs.writeFileSync(inputPath, file.buffer);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }

      const args = [
        '-i',
        inputPath,
        '-codec:v',
        'libx264',
        '-codec:a',
        'aac',
        '-preset',
        'slow',
        '-crf',
        '28',
        '-b:a',
        '128k',
        '-hls_segment_type',
        'fmp4',
        '-hls_time',
        '10',
        '-hls_list_size',
        '0',
        outputPath,
      ];

      const ffmpeg = spawn(ffmpegPath as string, args);

      ffmpeg.stderr.on('data', (data) => {
        console.log(`FFmpeg: ${data}`);
      });

      ffmpeg.on('close', async (code) => {
        if (code !== 0) {
          return reject(new Error(`FFmpeg failed with code ${code}`));
        }

        try {
          console.log('Conversion complete:', outputPath);

          const uploadStream = v2.uploader.upload_stream(
            { resource_type: 'video' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          );

          fs.createReadStream(outputPath).pipe(uploadStream);
        } catch (err) {
          reject(err);
        } finally {
          fs.rmSync(baseDir, { recursive: true, force: true });
        }
      });

      ffmpeg.on('error', reject);
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
