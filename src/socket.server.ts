import { Server as SocketIOServer, Socket } from 'socket.io';
import { Logger } from './utils/logger';
import { chatHandler } from './socket/chat.socket';
import { notificationHandler } from './socket/notification.socket';
import { roomHandler } from './socket/room.socket';

export class SocketServer {
  private static logger = new Logger('SocketServer');
  constructor(private io: SocketIOServer) {}
  public static initializeSocket(io: SocketIOServer): void {
    io.on('connection', (socket: Socket) => {
      this.logger.info(`👤 A user connected: ${socket.id}`);

      // Initialize different socket handlers
      chatHandler(io, socket);
      notificationHandler(io, socket);
      roomHandler(io, socket);

      socket.on('disconnect', () => {
        this.logger.info(`👋 User disconnected: ${socket.id}`);
      });

      socket.on('error', error => {
        this.logger.logError(error, 'SocketServer');
      });
    });
  }
}
