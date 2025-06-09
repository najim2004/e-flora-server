import { Server as SocketIOServer } from 'socket.io';
import Logger from '../utils/logger';
import { AuthenticatedSocket } from '../middlewares/socket.auth.middleware';
import { CropSuggestionOutput, CropSuggestionProgressUpdate } from '../types/cropSuggestion.types';

export class CropSuggestionSocketHandler {
  private static readonly ROOM = (id: string): string => `user:${id}:crop-suggestion`;
  private readonly io: SocketIOServer;
  private readonly log = Logger.getInstance('CropSuggestion');

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  registerSocketHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    const room = CropSuggestionSocketHandler.ROOM(userId);
    socket.removeAllListeners('leaveCropSuggestionRoom');
    socket.removeAllListeners('joinCropSuggestionRoom');

    socket.join(room);
    this.log.info(`User ${userId} joined ${room}`);

    socket.on('leaveCropSuggestionRoom', () => {
      socket.leave(room);
      this.log.info(`User ${userId} left ${room}`);
    });

    socket.on('joinCropSuggestionRoom', () => {
      socket.join(room);
      this.log.info(`User ${userId} rejoined ${room}`);
    });
  }

  async emitProgress({
    userId,
    status,
    progress,
    message,
  }: CropSuggestionProgressUpdate): Promise<void> {
    const room = CropSuggestionSocketHandler.ROOM(userId);
    this.io.to(room).emit('cropSuggestionProgressUpdate', {
      status,
      progress: Math.min(Math.max(0, progress), 100),
      message,
      timestamp: new Date(),
    });
    this.log.info(`Progress [${status} ${progress}%] sent to ${room}`);
    if (message) this.log.debug(`Message: ${message}`);
  }

  async emitCompleted(userId: string, data: CropSuggestionOutput): Promise<void> {
    const room = CropSuggestionSocketHandler.ROOM(userId);
    this.io.to(room).emit('cropSuggestionCompleted', { data, timestamp: new Date() });
    this.log.info(`Completed sent to ${userId}`);
  }

  async emitFailed(userId: string, message: string): Promise<void> {
    const room = CropSuggestionSocketHandler.ROOM(userId);
    this.io.to(room).emit('cropSuggestionFailed', { message, timestamp: new Date() });
    this.log.warn(`Failed sent to ${userId}: ${message}`);
  }

  async emitCropDetails(
    userId: string,
    data: {
      status: 'success' | 'failed';
      slug?: string;
      scientificName: string;
    }
  ): Promise<void> {
    const room = CropSuggestionSocketHandler.ROOM(userId);
    this.io.to(room).emit('individualCropDetailsUpdate', {
      ...data,
      timestamp: new Date(),
    });
    this.log.debug(`Details update for ${data.scientificName} sent to ${userId}`);
  }
}
