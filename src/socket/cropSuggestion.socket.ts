import { Server as SocketIOServer } from 'socket.io';
import Logger from '../utils/logger';
import { ICropRecommendations } from '../interfaces/cropRecommendations.interface';
import { AuthenticatedSocket } from '../middlewares/socket.auth.middleware';

export type CropSuggestionStatus =
  | 'initiated'
  | 'analyzing'
  | 'generatingData'
  | 'savingToDB'
  | 'completed'
  | 'failed';

export interface CropSuggestionProgressUpdate {
  userId: string;
  status: CropSuggestionStatus;
  progress: number;
  message?: string;
}

export interface CropDetailsUpdate {
  success: boolean;
  slug: string | null;
  scientificName: string;
  timestamp: Date;
}

export class CropSuggestionSocketHandler {
  private static readonly ROOM_PREFIX = 'user';
  private static readonly ROOM_SUFFIX = 'crop-suggestion';

  private readonly io: SocketIOServer;
  private readonly logger: Logger;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.logger = Logger.getInstance('CropSuggestion');
  }

  public registerSocketHandlers(socket: AuthenticatedSocket): void {
    try {
      const userId = socket.userId;
      const userRoom = this.getUserRoom(userId);

      this.cleanupExistingListeners(socket);
      this.joinUserRoom(socket, userRoom);
      this.setupEventListeners(socket, userRoom);
    } catch (error) {
      this.logger.error(
        `Error in registerSocketHandlers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async emitProgressUpdate(data: CropSuggestionProgressUpdate): Promise<void> {
    try {
      const userRoom = this.getUserRoom(data.userId);
      const updatePayload = {
        status: data.status,
        progress: this.validateProgress(data.progress),
        message: data.message,
        timestamp: new Date(),
      };

      await this.io.to(userRoom).emit('cropSuggestionProgressUpdate', updatePayload);
      this.logProgressUpdate(userRoom, data);
    } catch (error) {
      this.logger.error(
        `Error in emitProgressUpdate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async sendFinalRecommendations(
    userId: string,
    recommendationData: Pick<ICropRecommendations, '_id' | 'crops' | 'cultivationTips' | 'weathers'>
  ): Promise<void> {
    try {
      const userRoom = this.getUserRoom(userId);
      const payload = {
        ...recommendationData,
        timestamp: new Date(),
      };

      await this.io.to(userRoom).emit('finalCropRecommendations', payload);
      this.logger.info(`Final recommendations sent to user ${userId} in room ${userRoom}`);
    } catch (error) {
      this.logger.error(
        `Error sending final recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async emitCropDetailsUpdate(
    userId: string,
    cropSlug: string | null,
    scientificName: string
  ): Promise<void> {
    try {
      const userRoom = this.getUserRoom(userId);
      const updatePayload: CropDetailsUpdate = {
        success: Boolean(cropSlug),
        slug: cropSlug,
        scientificName,
        timestamp: new Date(),
      };

      await this.io.to(userRoom).emit('individualCropDetailsUpdate', updatePayload);
      this.logger.debug(`Crop details update sent for ${scientificName} to user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Error emitting crop details: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private getUserRoom(userId: string): string {
    if (!userId) throw new Error('User ID is required');
    return `${CropSuggestionSocketHandler.ROOM_PREFIX}:${userId}:${CropSuggestionSocketHandler.ROOM_SUFFIX}`;
  }

  private cleanupExistingListeners(socket: AuthenticatedSocket): void {
    socket.removeAllListeners('leaveCropSuggestionRoom');
    socket.removeAllListeners('joinCropSuggestionRoom');
  }

  private joinUserRoom(socket: AuthenticatedSocket, userRoom: string): void {
    socket.join(userRoom);
    this.logger.info(`User ${socket.userId} joined room: ${userRoom}`);
  }

  private setupEventListeners(socket: AuthenticatedSocket, userRoom: string): void {
    socket.on('leaveCropSuggestionRoom', () => {
      socket.leave(userRoom);
      this.logger.info(`User ${socket.userId} left room: ${userRoom}`);
    });

    socket.on('joinCropSuggestionRoom', () => {
      socket.join(userRoom);
      this.logger.info(`User ${socket.userId} rejoined room: ${userRoom}`);
    });
  }

  private validateProgress(progress: number): number {
    return Math.min(Math.max(0, progress), 100);
  }

  private logProgressUpdate(userRoom: string, data: CropSuggestionProgressUpdate): void {
    this.logger.info(`Progress update in room ${userRoom}: ${data.status} (${data.progress}%)`);
    if (data.message) {
      this.logger.debug(`Message: ${data.message}`);
    }
  }
}
