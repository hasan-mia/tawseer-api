import { MessageModule } from '@/message/message.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { SocketGateway } from './socket.gateway';

@Module({
  imports: [
    MessageModule,
    JwtModule
  ],
  providers: [SocketGateway, ChatGateway],
  exports: [SocketGateway, ChatGateway],
})
export class SocketModule { }
