import { MessageModule } from '@/message/message.module';
import { NotificationModule } from '@/notification/notification.module';
import { QueueModule } from '@/queueManagement/queue.module';
import { ConversationSchema } from '@/schemas/conversation.schema';
import { UserSchema } from '@/schemas/user.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGateway } from './chat.gateway';
import { QueueGateway } from './queue.gateway';
import { SocketGateway } from './socket.gateway';

@Module({
  imports: [
    MessageModule,
    NotificationModule,
    QueueModule,
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ]),
  ],
  providers: [SocketGateway, ChatGateway, QueueGateway],
  exports: [SocketGateway, ChatGateway, QueueGateway],
})
export class SocketModule { }
