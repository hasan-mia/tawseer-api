import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppointmentModule } from './appointment/appointment.module';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CouponModule } from './coupon/coupon.module';
import { FileUploadModule } from './fileupload/fileupload.module';
import { FriendModule } from './friend/friend.module';
import { MessageModule } from './message/message.module';
import { PaymentModule } from './payment/payment.module';
import { PostModule } from './post/post.module';
import { CommentModule } from './postcomment/comment.module';
import { ReplyModule } from './postreply/reply.module';
import { ProductModule } from './product/product.module';
import { RedisCacheService } from './rediscloud.service';
import { ReviewModule } from './review/review.module';
import { ServiceModule } from './service/service.module';
import { SocketModule } from './socket/socket.module';
import { UploadModule } from './upload/upload.module';
import { UserModule } from './user/user.module';
import { VendorModule } from './vendor/vendor.module';

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
    ServiceModule,
    ReviewModule,
    AppointmentModule,
    CouponModule,
    PostModule,
    CommentModule,
    ReplyModule,
    VendorModule,
    CategoryModule,
    ProductModule,
    MessageModule
  ],
  controllers: [AppController],
  providers: [AppService, RedisCacheService],
  exports: [RedisCacheService],
})
export class AppModule { }
