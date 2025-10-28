import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/tawseer' })
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  afterInit(server: Server) {
    console.log('Socket.io Initialized');
  }

  handleConnection(socket: Socket) {
    console.log(`Client connected: ${socket.id}`);
  }

  handleDisconnect(socket: Socket) {
    console.log(`Client disconnected: ${socket.id}`);
  }

  sendLiveMessage(event: string, message: string, data?: any) {
    this.server.emit(event, { message, data });
  }

  async sendMessageToRoom(roomId: string, event: string, message: string, status: any) {
    const sockets = await this.server.in(roomId).fetchSockets();
    console.log(`Emitting to room ${roomId} with ${sockets.length} clients`);
    this.server.to(roomId).emit(event, { status, message });
  }
}
