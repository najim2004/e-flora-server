import { Server as SocketIOServer } from 'socket.io';
import { Logger } from '../utils/logger';
import { AuthenticatedSocket } from '../middlewares/socket.auth.middleware';

export type DiseaseDetectionStatus =
  | 'initiated'
  | 'analyzing'
  | 'generatingData'
  | 'savingToDB'
  | 'completed'
  | 'failed';

export interface DiseaseDetectionProgressPayload {
  userId: string;
  status: DiseaseDetectionStatus;
  progress: number; // percentage from 0 to 100
  message?: string;
}

export interface DiseaseDetectionResultPayload {
  cropName: string;
  diseaseName: string;
  description: string;
  symptoms: string[];
  treatment: string[];
  causes: string[];
  preventiveTips: string[];
}

export class DiseaseDetectionSocketHandler {
  private io: SocketIOServer;
  private logger: Logger;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.logger = Logger.getInstance('DiseaseDetectionSocketHandler');
  }

  public registerSocketHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    const userRoom = this.getUserRoom(userId);

    socket.join(userRoom);
    this.logger.info(`User ${userId} joined room: ${userRoom}`);

    socket.removeAllListeners('leaveDiseaseDetectionRoom');
    socket.removeAllListeners('joinDiseaseDetectionRoom');

    socket.on('leaveDiseaseDetectionRoom', () => {
      socket.leave(userRoom);
      this.logger.info(`User ${userId} left room: ${userRoom}`);
    });

    socket.on('joinDiseaseDetectionRoom', () => {
      socket.join(userRoom);
      this.logger.info(`User ${userId} rejoined room: ${userRoom}`);
    });
  }

  public emitProgressUpdate(data: DiseaseDetectionProgressPayload): void {
    const room = this.getUserRoom(data.userId);
    this.io.to(room).emit('diseaseDetection:progressUpdate', {
      status: data.status,
      progress: data.progress,
      message: data.message,
      timestamp: new Date(),
    });

    this.logger.info(`Progress [${data.status}] ${data.progress}% → ${room}`);
    if (data.message) {
      this.logger.debug(`Message: ${data.message}`);
    }
  }

  public emitFinalResult(userId: string, result: DiseaseDetectionResultPayload): void {
    const room = this.getUserRoom(userId);
    this.io.to(room).emit('diseaseDetection:result', {
      ...result,
      timestamp: new Date(),
    });

    this.logger.info(`Final disease detection result emitted to ${room}`);
  }

  public emitError(userId: string, errorMessage: string): void {
    const room = this.getUserRoom(userId);
    this.io.to(room).emit('diseaseDetection:error', {
      error: errorMessage,
      timestamp: new Date(),
    });

    this.logger.error(`Error sent to ${room}: ${errorMessage}`);
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}:disease-detection`;
  }
}
