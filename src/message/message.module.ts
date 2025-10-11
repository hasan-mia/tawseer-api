import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { NotificationModule } from '@/notification/notification.module';
import { RedisCacheService } from '@/rediscloud.service';
import { AppointmentSchema } from '@/schemas/appointment.schema';
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
import { QueueService } from './queue.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = config.get<string | number>('JWT_SECRET_EXPIRES');

        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            // Convert string to number if it's numeric
            expiresIn: typeof expiresIn === 'string' && !isNaN(+expiresIn)
              ? Number(expiresIn)
              : (expiresIn as any),
          },
        };
      },
    }),
    MongooseModule.forFeature([
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Vendor', schema: VendorSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'Appointment', schema: AppointmentSchema },
    ]),
    NotificationModule,
  ],
  controllers: [MessageController],
  providers: [MessageService, ChatGateway, QueueService, CloudinaryService, RedisCacheService],
  exports: [MessageService],
})
export class MessageModule { }