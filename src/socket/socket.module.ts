import { MessageModule } from '@/message/message.module';
import { ConversationSchema } from '@/schemas/conversation.schema';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGateway } from './chat.gateway';
import { SocketGateway } from './socket.gateway';

@Module({
  imports: [
    MessageModule,
    JwtModule,
    MongooseModule.forFeature([
      { name: 'Conversation', schema: ConversationSchema },
    ]),
  ],
  providers: [SocketGateway, ChatGateway],
  exports: [SocketGateway, ChatGateway],
})
export class SocketModule { }
