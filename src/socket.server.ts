import { Server as SocketIOServer, Socket } from 'socket.io';
import { Logger } from './utils/logger';
import { CropSuggestionSocketHandler } from './socket/cropSuggestion.socket';
import { AuthenticatedSocket } from './middlewares/socket.auth.middleware';
import { DiseaseDetectionSocketHandler } from './socket/diseaseDetection.socket';

export class SocketServer {
  private static instance: SocketServer;
  private io: SocketIOServer;
  private logger = Logger.getInstance('SocketServer');

  // Socket handler instances
  private cropSuggestionSocketHandler: CropSuggestionSocketHandler;
  private diseaseDetectionHandler: DiseaseDetectionSocketHandler;

  private constructor(io: SocketIOServer) {
    this.io = io;

    // Initialize handler classes, inject io
    this.cropSuggestionSocketHandler = new CropSuggestionSocketHandler(io);
    this.diseaseDetectionHandler = new DiseaseDetectionSocketHandler(io);

    this.initialize();
  }

  // Singleton getInstance method
  public static getInstance(io?: SocketIOServer): SocketServer {
    if (!SocketServer.instance && !io) {
      throw new Error('Socket.IO server instance is required for first-time initialization.');
    }

    if (!SocketServer.instance && io) {
      SocketServer.instance = new SocketServer(io);
    }

    return SocketServer.instance!;
  }

  private initialize(): void {
    this.io.on('connection', ((socket: Socket) => {
      // Type assertion since we know the middleware has added userId
      const authSocket = socket as AuthenticatedSocket;
      this.logger.info(`👤 User connected: ${authSocket.id}`);

      // Register handlers per socket connection
      this.cropSuggestionSocketHandler.registerSocketHandlers(authSocket);
      this.diseaseDetectionHandler.registerSocketHandlers(authSocket);

      authSocket.on('disconnect', () => {
        this.logger.info(`👋 User disconnected: ${authSocket.id}`);
      });

      authSocket.on('error', error => {
        this.logger.logError(error, 'SocketServer');
      });
    }) as (socket: Socket) => void);
  }

  // Public accessor for io instance
  public getIO(): SocketIOServer {
    return this.io;
  }

  // Public getters for socket modules (optional)
  public getCropSuggestionSocketHandler(): CropSuggestionSocketHandler {
    return this.cropSuggestionSocketHandler;
  }
  public getDiseaseDetectionSocketHandler(): DiseaseDetectionSocketHandler {
    return this.diseaseDetectionHandler;
  }
  // Similarly you can add getters for other sockets if needed
}
