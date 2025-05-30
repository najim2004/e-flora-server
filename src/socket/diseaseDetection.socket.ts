import { Server as SocketIOServer } from 'socket.io';
import Logger from '../utils/logger';
import { AuthenticatedSocket } from '../middlewares/socket.auth.middleware';
import {
  DiseaseDetectionProgressPayload,
} from '../types/diseaseDetection.type';

// Constants
const SOCKET_EVENTS = {
  LEAVE_ROOM: 'leaveDiseaseDetectionRoom',
  JOIN_ROOM: 'joinDiseaseDetectionRoom',
  PROGRESS_UPDATE: 'diseaseDetection:progressUpdate',
  RESULT: 'diseaseDetection:result',
  ERROR: 'diseaseDetection:error',
} as const;

export class DiseaseDetectionSocketHandler {
  private readonly io: SocketIOServer;
  private readonly logger: Logger;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.logger = Logger.getInstance('DiseaseDetection');
  }

  /**
   * Registers socket event handlers for a user
   * @param socket Authenticated socket instance
   */
  public registerSocketHandlers(socket: AuthenticatedSocket): void {
    const { userId } = socket;
    const userRoom = this.getUserRoom(userId);

    // Clean up existing listeners before adding new ones
    this.cleanupExistingListeners(socket);

    // Join user to their room
    this.joinUserToRoom(socket, userRoom);

    // Register event handlers
    this.registerRoomEvents(socket, userRoom);
  }

  /**
   * Emits progress update to user's room
   * @param data Progress update payload
   */
  public emitProgressUpdate(data: DiseaseDetectionProgressPayload): void {
    const room = this.getUserRoom(data.userId);
    const payload = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    this.io.to(room).emit(SOCKET_EVENTS.PROGRESS_UPDATE, payload);
    this.logProgress(data, room);
  }

  /**
   * Emits final detection result to user's room
   * @param userId User ID
   * @param result Detection result payload
   */
  public emitFinalResult(userId: string, result:{resultId:string}): void {
    const room = this.getUserRoom(userId);
    const payload = {
      ...result,
      timestamp: new Date().toISOString(),
    };

    this.io.to(room).emit(SOCKET_EVENTS.RESULT, payload);
    this.logger.info(`Final disease detection result emitted to ${room}`);
  }

  /**
   * Emits error message to user's room
   * @param userId User ID
   * @param errorMessage Error message
   */
  public emitError(userId: string, errorMessage: string): void {
    const room = this.getUserRoom(userId);
    const payload = {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    this.io.to(room).emit(SOCKET_EVENTS.ERROR, payload);
    this.logger.error(`Error sent to ${room}: ${errorMessage}`);
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}:disease-detection`;
  }

  private cleanupExistingListeners(socket: AuthenticatedSocket): void {
    socket.removeAllListeners(SOCKET_EVENTS.LEAVE_ROOM);
    socket.removeAllListeners(SOCKET_EVENTS.JOIN_ROOM);
  }

  private joinUserToRoom(socket: AuthenticatedSocket, room: string): void {
    socket.join(room);
    this.logger.info(`User ${socket.userId} joined room: ${room}`);
  }

  private registerRoomEvents(socket: AuthenticatedSocket, room: string): void {
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
      socket.leave(room);
      this.logger.info(`User ${socket.userId} left room: ${room}`);
    });

    socket.on(SOCKET_EVENTS.JOIN_ROOM, () => {
      socket.join(room);
      this.logger.info(`User ${socket.userId} rejoined room: ${room}`);
    });
  }

  private logProgress(data: DiseaseDetectionProgressPayload, room: string): void {
    this.logger.info(`Progress [${data.status}] ${data.progress}% → ${room}`);
    if (data.message) {
      this.logger.debug(`Message: ${data.message}`);
    }
  }
}
