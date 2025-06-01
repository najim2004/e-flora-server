import { Server as SocketIOServer } from 'socket.io';
import Logger from '../utils/logger';
import { AuthenticatedSocket } from '../middlewares/socket.auth.middleware';
import { DiseaseDetectionProgressPayload } from '../types/diseaseDetection.type';

export class DiseaseDetectionSocketHandler {
  private static readonly ROOM = (id: string): string => `user:${id}:disease-detection`;
  private readonly io: SocketIOServer;
  private readonly log = Logger.getInstance('DiseaseDetection');

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  registerSocketHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    const room = DiseaseDetectionSocketHandler.ROOM(userId);
    socket.removeAllListeners('leaveDiseaseDetectionRoom');
    socket.removeAllListeners('joinDiseaseDetectionRoom');

    socket.join(room);
    this.log.info(`User ${userId} joined ${room}`);

    socket.on('leaveDiseaseDetectionRoom', () => {
      socket.leave(room);
      this.log.info(`User ${userId} left ${room}`);
    });

    socket.on('joinDiseaseDetectionRoom', () => {
      socket.join(room);
      this.log.info(`User ${userId} rejoined ${room}`);
    });
  }

  async emitProgressUpdate({
    userId,
    status,
    progress,
    message,
  }: DiseaseDetectionProgressPayload): Promise<void> {
    const room = DiseaseDetectionSocketHandler.ROOM(userId);
    this.io.to(room).emit('diseaseDetection:progressUpdate', {
      status,
      progress: Math.min(Math.max(0, progress), 100),
      message,
      timestamp: new Date(),
    });
    this.log.info(`Progress [${status} ${progress}%] sent to ${room}`);
    if (message) this.log.debug(`Message: ${message}`);
  }

  async emitFinalResult(userId: string, result: { resultId: string }): Promise<void> {
    const room = DiseaseDetectionSocketHandler.ROOM(userId);
    this.io.to(room).emit('diseaseDetection:result', { ...result, timestamp: new Date() });
    this.log.info(`Final disease detection result sent to ${userId}`);
  }

  async emitError(userId: string, error: string): Promise<void> {
    const room = DiseaseDetectionSocketHandler.ROOM(userId);
    this.io.to(room).emit('diseaseDetection:error', { error, timestamp: new Date() });
    this.log.warn(`Error sent to ${userId}: ${error}`);
  }
}
