import { Server as SocketIOServer, Socket } from 'socket.io';
import Logger from './utils/logger';
import { CropSuggestionSocketHandler } from './socket/cropSuggestion.socket';
import { AuthenticatedSocket } from './middlewares/socket.auth.middleware';
import { DiseaseDetectionSocketHandler } from './socket/diseaseDetection.socket';

export class SocketServer {
  private static instance: SocketServer;
  private io: SocketIOServer | null = null;
  private logger = Logger.getInstance('SocketServer');
  private isInitialized = false;

  // Socket handler instances
  private cropSuggestionSocketHandler: CropSuggestionSocketHandler | null = null;
  private diseaseDetectionHandler: DiseaseDetectionSocketHandler | null = null;

  private constructor() {
    // Empty constructor for singleton
  }

  // Singleton getInstance method
  public static getInstance(): SocketServer {
    if (!SocketServer.instance) {
      SocketServer.instance = new SocketServer();
    }
    return SocketServer.instance;
  }

  // Initialize method to be called when Socket.IO server is ready
  public initialize(io: SocketIOServer): void {
    if (this.isInitialized) {
      this.logger.warn('Socket server already initialized');
      return;
    }

    this.io = io;

    // Initialize handler classes
    this.cropSuggestionSocketHandler = new CropSuggestionSocketHandler(io);
    this.diseaseDetectionHandler = new DiseaseDetectionSocketHandler(io);

    this.setupSocketHandlers();
    this.isInitialized = true;
    this.logger.info('Socket server initialized successfully');
  }

  private setupSocketHandlers(): void {
    if (!this.io) {
      throw new Error('Socket.IO server not initialized');
    }

    this.io.on('connection', ((socket: Socket) => {
      // Type assertion since we know the middleware has added userId
      const authSocket = socket as AuthenticatedSocket;
      this.logger.info(`👤 User connected: ${authSocket.id}`);

      // Register handlers per socket connection
      this.cropSuggestionSocketHandler?.registerSocketHandlers(authSocket);
      this.diseaseDetectionHandler?.registerSocketHandlers(authSocket);

      authSocket.on('disconnect', () => {
        this.logger.info(`👋 User disconnected: ${authSocket.id}`);
      });

      authSocket.on('error', error => {
        this.logger.logError(error, 'SocketServer');

        authSocket.emit('global:error', {
          error: 'A server error occurred. Please try again later.',
          details: error?.message || 'Unknown error',
          timestamp: new Date(),
        });
      });
    }) as (socket: Socket) => void);
  }

  // Public accessor for io instance
  public getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.IO server not initialized. Call initialize() first.');
    }
    return this.io;
  }

  // Check if initialized
  public isReady(): boolean {
    return this.isInitialized && this.io !== null;
  }

  // Public getters for socket modules
  public cropSuggestion(): CropSuggestionSocketHandler {
    if (!this.cropSuggestionSocketHandler) {
      throw new Error('Socket server not initialized. Call initialize() first.');
    }
    return this.cropSuggestionSocketHandler;
  }

  public diseaseDetection(): DiseaseDetectionSocketHandler {
    if (!this.diseaseDetectionHandler) {
      throw new Error('Socket server not initialized. Call initialize() first.');
    }
    return this.diseaseDetectionHandler;
  }
}
