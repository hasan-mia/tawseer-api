import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { NotificationModule } from '@/notification/notification.module';
import { RedisCacheService } from '@/rediscloud.service';
import { ConversationSchema } from '@/schemas/conversation.schema';
import { MessageSchema } from '@/schemas/message.schema';
import { UserSchema } from '@/schemas/user.schema';
import { VendorSchema } from '@/schemas/vendor.schema';
import { ChatGateway } from '@/socket/chat.gateway';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: config.get<string | number>('JWT_SECRET_EXPIRES'),
          },
        };
      },
    }),
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Vendor', schema: VendorSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ]),
    NotificationModule,
  ],
  controllers: [MessageController],
  providers: [MessageService, ChatGateway, CloudinaryService, RedisCacheService],
  exports: [MessageService, ChatGateway],
})
export class MessageModule { }