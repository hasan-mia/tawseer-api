/* eslint-disable prettier/prettier */
import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CouponModule } from './coupon/coupon.module';
import { FileUploadModule } from './fileupload/fileupload.module';
import { FriendModule } from './friend/friend.module';
import { PaymentModule } from './payment/payment.module';
import { PostModule } from './post/post.module';
import { CommentModule } from './postcomment/comment.module';
import { ReplyModule } from './postreply/reply.module';
import { RedisCacheService } from './rediscloud.service';
import { SalonModule } from './salon/salon.module';
import { AppointmentModule } from './salonAppointment/appointment.module';
import { ReviewModule } from './salonReview/review.module';
import { ServiceModule } from './salonService/service.module';
import { SocketModule } from './socket/socket.module';
import { UploadModule } from './upload/upload.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.DB_URI),
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_MAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      },
    }),
    SocketModule,
    FileUploadModule,
    CloudinaryModule,
    AuthModule,
    UserModule,
    PaymentModule,
    UploadModule,
    FriendModule,
    SalonModule,
    ServiceModule,
    ReviewModule,
    AppointmentModule,
    CouponModule,
    PostModule,
    CommentModule,
    ReplyModule,
  ],
  controllers: [AppController],
  providers: [AppService, RedisCacheService],
  exports: [RedisCacheService],
})
export class AppModule { }
