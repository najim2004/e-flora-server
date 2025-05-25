import { Server as SocketIOServer } from 'socket.io';
import { Logger } from '../utils/logger';
import { ICropRecommendations } from '../interfaces/cropRecommendations.interface';
import { AuthenticatedSocket } from '../middlewares/socket.auth.middleware';

/**
 * Defines the structure for broadcasting crop suggestion progress updates.
 */
export interface CropSuggestionProgressUpdate {
  userId: string;
  status: 'started' | 'processing' | 'completed' | 'failed';
  progress: number; // Percentage of completion (0-100)
  message?: string; // Optional descriptive message about the current stage
}


/**
 * Manages WebSocket communication for crop suggestion processes.
 * This class handles real-time updates for users, including progress, final recommendations,
 * and details about individual crops.
 */
export class CropSuggestionSocketHandler {
  private io: SocketIOServer;
  private logger: Logger;

  /**
   * Constructs a new CropSuggestionSocketHandler.
   * @param io The Socket.IO server instance.
   */
  constructor(io: SocketIOServer) {
    this.io = io;
    this.logger = new Logger('CropSuggestionSocketHandler');
  }

  /**
   * Registers Socket.IO event handlers for a new client connection.
   * Users are automatically joined into a room specific to their `userId` upon connection.
   *
   * @param socket The authenticated Socket.IO client instance.
   */
  public registerSocketHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    const userRoom = this.getUserRoom(userId);

    // Automatically join the user's dedicated room when they connect.
    socket.join(userRoom);
    this.logger.info(`User ${userId} joined room: ${userRoom} on connection.`);

    // Handler for a client explicitly leaving the crop suggestion room.
    socket.on('leaveCropSuggestionRoom', () => {
      socket.leave(userRoom);
      this.logger.info(`User ${userId} explicitly left crop suggestion room: ${userRoom}.`);
    });

    // Handler for a client explicitly rejoining the crop suggestion room.
    socket.on('joinCropSuggestionRoom', () => {
      socket.join(userRoom);
      this.logger.info(`User ${userId} explicitly rejoined crop suggestion room: ${userRoom}.`);
    });
  }

  /**
   * Emits progress updates to a specific user's room.
   * This keeps the client informed about the status and progression of the crop suggestion process.
   *
   * @param data The progress update data.
   */
  public emitProgressUpdate(data: CropSuggestionProgressUpdate): void {
    const userRoom = this.getUserRoom(data.userId);
    this.io.to(userRoom).emit('cropSuggestionProgressUpdate', {
      status: data.status,
      progress: data.progress,
      message: data.message,
      timestamp: new Date(), // Add a timestamp for client-side timing/logging
    });

    this.logger.info(
      `Emitting progress to room: ${userRoom} | Status: ${data.status} | Progress: ${data.progress}%`
    );
    if (data.message) {
      this.logger.debug(`Progress message for ${userRoom}: ${data.message}`);
    }
  }

  /**
   * Sends the final crop recommendations result to a specific user's room.
   * This is typically the last update after the core recommendations are generated and saved.
   *
   * @param userId The ID of the user to send recommendations to.
   * @param recommendationData The crop recommendation data (excluding full crop details).
   */
  public sendFinalRecommendations(
    userId: string,
    recommendationData: Pick<ICropRecommendations, '_id' | 'crops' | 'cultivationTips' | 'weathers'>
  ): void {
    const userRoom = this.getUserRoom(userId);
    this.io.to(userRoom).emit('finalCropRecommendations', {
      ...recommendationData,
      timestamp: new Date(), // Add a timestamp
    });

    this.logger.info(
      `Emitting final crop recommendations for user: ${userId} in room: ${userRoom}.`
    );
    this.logger.debug(`Recommendation data: ${JSON.stringify(recommendationData._id)}`); // Log ID, not full data
  }

  /**
   * Emits the details (slug and scientific name) for an individual crop to the user.
   * This allows the client to dynamically update details for each recommended crop as they become available.
   *
   * @param userId The ID of the user.
   * @param cropSlug The slug of the crop details, or null if generation failed.
   * @param scientificName The scientific name of the crop.
   */
  public emitCropDetailsUpdate(
    userId: string,
    cropSlug: string | null,
    scientificName: string
  ): void {
    const userRoom = this.getUserRoom(userId);
    this.io.to(userRoom).emit('individualCropDetailsUpdate', {
      success: !!cropSlug, // Boolean indicating if details were successfully retrieved/generated
      slug: cropSlug,
      scientificName: scientificName,
      timestamp: new Date(), // Add a timestamp
    });

    this.logger.info(
      `Emitting details update for ${scientificName} to user: ${userId}. Success: ${!!cropSlug}`
    );
  }

  /**
   * Generates a unique room name for a given user ID.
   * @param userId The ID of the user.
   * @returns The room name string.
   */
  private getUserRoom(userId: string): string {
    return `user:${userId}:crop-suggestion`;
  }
}
