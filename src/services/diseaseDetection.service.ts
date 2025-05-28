import { imageKitUtil } from '../utils/imageKit.util';
import { DiseaseDetection } from '../models/diseaseDetection.model'; // Assuming this is your Disease model (not DiseaseDetectionHistory)
import { DiseaseDetectionHistory } from '../models/diseaseDetectionHistory.model'; // Assuming this is your History model
import { Logger } from '../utils/logger';
import { InputDetectDisease, OutputDetectDisease } from '../types/diseaseDetection.type';
import { DiseaseDetectionPrompt } from '../prompts/diseaseDetection.prompt';
import GeminiUtils, { gemini } from '../utils/gemini.utils';
import { FileUploadUtil } from '../utils/multer.util';
import mongoose, { PipelineStage } from 'mongoose';
import { IDiseaseDetectionHistory } from '../interfaces/diseaseDetectionHistory.interface';
import { DiseaseDetectionResultPayload } from '../socket/diseaseDetection.socket';
import { SocketServer } from '../socket.server';

// ---
// IMPORTANT: This service needs dependencies injected from your main application (e.g., app.ts/server.ts)
// Do NOT initialize FileUploadUtil, ImageKitUtil, GeminiUtils, Logger, DiseaseDetectionSocketHandler directly here.
// These should be singletons or managed by a dependency injection container.
// ---

export class DiseaseDetectionService {
  // Dependencies are now injected, not instantiated directly
  private diseaseDetectionModel = DiseaseDetection; // Mongoose Model instance (already initialized)
  private diseaseDetectionModelHistory = DiseaseDetectionHistory; // Mongoose Model instance
  private logger: Logger;
  private gemini = gemini;
  private uploadUtil: FileUploadUtil;
  private socketHandler: SocketServer; // Socket handler for real-time updates

  // Prompts can remain static if they don't depend on instance data
  private static prompts = DiseaseDetectionPrompt;

  /**
   * @constructor
   * @param imageKitUtil - Injected ImageKit utility instance.
   * @param logger - Injected Logger utility instance.
   * @param gemini - Injected Gemini utility instance.
   * @param uploadUtil - Injected FileUpload utility instance (for temp file cleanup).
   * @param socketHandler - Injected Socket.IO handler for real-time updates.
   */
  constructor() {
    this.logger = Logger.getInstance('DiseaseDetection');
    this.uploadUtil = new FileUploadUtil('temp-uploads', 5, [
      'image/jpeg',
      'image/png',
      'image/jpg',
    ]);
    this.socketHandler = SocketServer.getInstance(); // Initialize socket handler
  }

  /**
   * Main method to detect disease, handle history, and manage data flow.
   * Implements a robust workflow with real-time updates and transactional integrity.
   * @param input - Contains userId, cropName, description, and image file.
   */
  public async detectDisease(input: InputDetectDisease): Promise<void> {
    const session = await mongoose.startSession(); // Start Mongoose session for transaction
    session.startTransaction(); // Begin transaction

    const { userId, cropName, description, image } = input;
    let uploadedFileId: string | undefined; // To track ImageKit file ID for cleanup
    let resultPayload: OutputDetectDisease; // The final output disease details

    try {
      this.socketHandler.diseaseDetection().emitProgressUpdate({
        userId,
        status: 'initiated',
        progress: 5,
        message: 'Starting detection process...',
      });
      this.logger.info(`Detection initiated for user: ${userId}, crop: ${cropName}`);

      // 1. Check for existing successful detection history by cropName
      const existingDetectionByCropName = await this.getDiseaseDetailsByCropName(cropName, session);
      if (existingDetectionByCropName) {
        this.logger.info(
          `Existing detection found by crop name for user: ${userId}, crop: ${cropName}`
        );
        await this.createNewHistory(
          userId,
          cropName,
          description,
          image,
          existingDetectionByCropName._id,
          session
        );
        await session.commitTransaction(); // Commit transaction on success path
        this.socketHandler.diseaseDetection().emitProgressUpdate({
          userId,
          status: 'completed',
          progress: 100,
          message: 'Detection completed using existing data.',
        });
        resultPayload = existingDetectionByCropName;
        // Clean up temporary image file after successful upload/history creation
        await this.uploadUtil.deleteFile(image.path);
        this.socketHandler
          .diseaseDetection()
          .emitFinalResult(userId, this.mapToResultPayload(resultPayload, cropName));
        return;
      }

      this.socketHandler.diseaseDetection().emitProgressUpdate({
        userId,
        status: 'analyzing',
        progress: 20,
        message: 'Analyzing image and generating embeddings...',
      });

      // 2. Detect disease name and generate embedding using Gemini
      const { diseaseName, embedded } = await this.detectDiseaseAndMakeNewEmbedding(
        cropName,
        image,
        description
      );
      if (!embedded || !diseaseName || embedded.length === 0) {
        throw new Error('Failed to detect disease name or generate embedding from AI.');
      }
      this.logger.info(`Disease name detected: "${diseaseName}" for crop: ${cropName}`);

      // 3. Check for existing disease based on generated embedding (semantic search)
      const existingDetectionByEmbedding = await this.getDiseaseDetailsByEmbedding(
        diseaseName,
        embedded,
        session
      );
      if (existingDetectionByEmbedding) {
        this.logger.info(
          `Existing detection found by embedding for user: ${userId}, disease: ${diseaseName}`
        );
        await this.createNewHistory(
          userId,
          cropName,
          description,
          image,
          existingDetectionByEmbedding._id,
          session
        );
        await session.commitTransaction(); // Commit transaction on success path
        this.socketHandler.diseaseDetection().emitProgressUpdate({
          userId,
          status: 'completed',
          progress: 100,
          message: 'Detection completed using existing embedded data.',
        });
        resultPayload = existingDetectionByEmbedding;
        // Clean up temporary image file
        await this.uploadUtil.deleteFile(image.path);
        this.socketHandler
          .diseaseDetection()
          .emitFinalResult(userId, this.mapToResultPayload(resultPayload, cropName));
        return;
      }

      this.socketHandler.diseaseDetection().emitProgressUpdate({
        userId,
        status: 'generatingData',
        progress: 60,
        message: 'Generating new disease details...',
      });

      // 4. Generate full details for a new detected disease (if not found by name or embedding)
      const newDiseaseDetails = await this.generateFullDetailsOfNewDetectedDisease(
        diseaseName,
        cropName,
        description
      );
      this.logger.info(`Generated new disease details for: ${diseaseName}`);

      // 5. Save the new disease details to the main Disease Detection Model
      const savedNewDisease = await this.diseaseDetectionModel.create(
        [{ ...newDiseaseDetails, embedded }],
        { session }
      );
      if (!savedNewDisease || savedNewDisease.length === 0) {
        throw new Error('Failed to save new disease details to database.');
      }
      const newDiseaseId = savedNewDisease[0]._id;
      this.logger.info(`New disease details saved with ID: ${newDiseaseId}`);

      this.socketHandler.diseaseDetection().emitProgressUpdate({
        userId,
        status: 'savingToDB',
        progress: 80,
        message: 'Saving detection history...',
      });

      // 6. Create a new history entry
      await this.createNewHistory(userId, cropName, description, image, newDiseaseId, session);
      await session.commitTransaction(); // Commit transaction on success path
      this.socketHandler.diseaseDetection().emitProgressUpdate({
        userId,
        status: 'completed',
        progress: 100,
        message: 'New disease detected and history saved.',
      });

      resultPayload = savedNewDisease[0].toObject() as OutputDetectDisease;
      // Clean up temporary image file
      await this.uploadUtil.deleteFile(image.path);
      this.socketHandler
        .diseaseDetection()
        .emitFinalResult(userId, this.mapToResultPayload(resultPayload, cropName));
      return;
    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      this.logger.logError(
        error as Error,
        `Failed to detect disease for user ${userId} and crop ${cropName}`
      );
      this.socketHandler
        .diseaseDetection()
        .emitError(
          userId,
          `Disease detection failed: ${(error as Error).message || 'Unknown error'}`
        );

      // Clean up temporary image file if it exists after error
      if (image?.path) {
        await this.uploadUtil.deleteFile(image.path);
      }
      // If image was uploaded to ImageKit before failure, delete it
      if (uploadedFileId) {
        await imageKitUtil.deleteImage(uploadedFileId);
      }
      // throw error; // Re-throw the error for outer error handling (e.g., in controller)
    } finally {
      // End the session regardless of success or failure
      session.endSession();
    }
  }

  /**
   * Retrieves disease details from history by crop name.
   * @param cropName - The name of the crop.
   * @param session - Mongoose client session for transactions.
   * @returns OutputDetectDisease or null if not found.
   */
  private async getDiseaseDetailsByCropName(
    cropName: string,
    session: mongoose.ClientSession
  ): Promise<OutputDetectDisease | null> {
    const history = await this.diseaseDetectionModelHistory
      .findOne({
        cropName,
        'detectedDisease.status': 'success',
      })
      .select('detectedDisease.id')
      .populate({
        path: 'detectedDisease.id',
        select: '-__v -createdAt -updatedAt -embedded',
      })
      .session(session) // Attach session to the query
      .exec();

    // Check if history and populated disease data exist
    if (history?.detectedDisease?.id) {
      return history.detectedDisease.id.toObject();
    }

    // Fallback: Check primary DiseaseDetection model directly if not found in history
    // This is optional if history is the primary source, but good for initial population or missing history.
    const detectedDisease = await this.diseaseDetectionModel
      .findOne({ cropName })
      .select('-__v -createdAt -updatedAt -embedded')
      .session(session) // Attach session
      .exec();

    return detectedDisease ? detectedDisease.toObject() : null;
  }

  /**
   * Detects disease name and generates embedding using Gemini AI.
   * @param cropName - The name of the crop.
   * @param image - The uploaded image file.
   * @param description - Optional description.
   * @returns Object containing detected disease name and its embedding.
   */
  private async detectDiseaseAndMakeNewEmbedding(
    cropName: string,
    image: Express.Multer.File,
    description?: string
  ): Promise<{ diseaseName: string; embedded: number[] }> {
    try {
      const prompt = DiseaseDetectionService.prompts.getDiseaseNameGettingPrompt(
        cropName,
        description
      );
      const detectedDiseaseName = await this.gemini.generateResponseWithImage(prompt, {
        path: image.path,
        mimeType: image.mimetype,
      });

      // Unified error handling for Gemini responses
      if (!detectedDiseaseName || detectedDiseaseName === 'ERROR_INVALID_IMAGE') {
        throw new Error('Image processing failed or invalid image.');
      } else if (detectedDiseaseName === 'NO_DISEASE_DETECTED') {
        throw new Error('No specific disease detected for the provided image and description.');
      }

      const generatedEmbedding = await this.gemini.generateEmbedding(detectedDiseaseName);
      if (!generatedEmbedding || generatedEmbedding.length === 0) {
        throw new Error('Failed to generate embedding for the detected disease name.');
      }
      return { diseaseName: detectedDiseaseName, embedded: generatedEmbedding };
    } catch (error) {
      this.logger.logError(
        error as Error,
        'Error during Gemini AI interaction for disease detection/embedding.'
      );
      throw error; // Re-throw for transaction rollback
    }
  }

  /**
   * Searches for an existing disease in the database using embedding similarity.
   * @param diseaseName - Detected disease name (for initial text search).
   * @param queryEmbedding - Embedding of the detected disease name.
   * @param session - Mongoose client session for transactions.
   * @returns Best matched disease details or null.
   */
  private async getDiseaseDetailsByEmbedding(
    diseaseName: string,
    queryEmbedding: number[],
    session: mongoose.ClientSession
  ): Promise<OutputDetectDisease | null> {
    try {
      // Use the static search method with session
      const allDetectedDiseaseWithRelatedThisKeyWord = await DiseaseDetectionService.search(
        diseaseName,
        session
      );
      if (allDetectedDiseaseWithRelatedThisKeyWord.length > 0) {
        const bestMatchedDisease = DiseaseDetectionService.findBestMatch(
          allDetectedDiseaseWithRelatedThisKeyWord,
          queryEmbedding
        );
        return bestMatchedDisease;
      }
      return null;
    } catch (error) {
      this.logger.logError(error as Error, 'Error checking existing disease with embedded data.');
      throw error; // Re-throw for transaction rollback
    }
  }

  /**
   * Finds the best matching disease based on cosine similarity of embeddings.
   * @param dataArray - Array of disease data including embeddings.
   * @param queryEmbedding - The embedding to match against.
   * @returns Best matched disease details or null.
   */
  private static findBestMatch(
    dataArray: (OutputDetectDisease & { embedded: number[] })[],
    queryEmbedding: number[]
  ): OutputDetectDisease | null {
    if (!dataArray.length) return null;

    let bestMatch: OutputDetectDisease | null = null;
    let bestScore = -Infinity;

    for (const data of dataArray) {
      if (!data.embedded || data.embedded.length !== queryEmbedding.length) continue;

      const { embedded, ...rest } = data; // Exclude embedded field from the result
      const score = GeminiUtils.calculateCosineSimilarity(queryEmbedding, embedded);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = rest;
      }
    }
    // Optional: Set a minimum similarity threshold if needed
    // if (bestScore < 0.7) return null;
    return bestMatch;
  }

  /**
   * Performs text-based search on disease data using aggregation.
   * @param query - The search query string.
   * @param session - Mongoose client session for transactions.
   * @returns Array of matched disease data.
   */
  static async search(
    query: string,
    session: mongoose.ClientSession
  ): Promise<(OutputDetectDisease & { embedded: number[] })[]> {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return []; // Return empty if no tokens to search

    const $or: NonNullable<PipelineStage.Match['$match']>['$or'] = tokens.flatMap(token => [
      { diseaseName: { $regex: token, $options: 'i' } },
      { cropName: { $regex: token, $options: 'i' } },
      { description: { $regex: token, $options: 'i' } },
      { symptoms: { $elemMatch: { $regex: token, $options: 'i' } } },
      { causes: { $elemMatch: { $regex: token, $options: 'i' } } },
      { treatment: { $elemMatch: { $regex: token, $options: 'i' } } },
      { preventiveTips: { $elemMatch: { $regex: token, $options: 'i' } } },
    ]);

    const concatFields = [
      { $ifNull: ['$diseaseName', ''] },
      ' ',
      { $ifNull: ['$cropName', ''] },
      ' ',
      { $ifNull: ['$description', ''] },
      ' ',
      ...['symptoms', 'causes', 'treatment', 'preventiveTips'].map(field => ({
        $reduce: {
          input: { $ifNull: [`$${field}`, []] },
          initialValue: '',
          in: { $concat: ['$$value', ' ', '$$this'] },
        },
      })),
    ];

    const aggregation: PipelineStage[] = [
      { $match: { $or } },
      {
        $addFields: {
          matchScore: {
            $sum: tokens.map(token => ({
              $cond: [
                {
                  $regexMatch: {
                    input: { $concat: concatFields },
                    regex: token,
                    options: 'i',
                  },
                },
                1,
                0,
              ],
            })),
          },
        },
      },
      { $match: { matchScore: { $gt: 0 } } },
      { $sort: { matchScore: -1 } },
      {
        $project: {
          matchScore: 0,
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ];

    // Attach session to aggregation
    return DiseaseDetection.aggregate(aggregation).session(session);
  }

  /**
   * Uploads the image to ImageKit and returns its URL and ID.
   * @param image - The Express.Multer.File object.
   * @returns Object with image URL and ID.
   */
  private async uploadImage(image: Express.Multer.File): Promise<{ url: string; id: string }> {
    try {
      const uploadResponse = await imageKitUtil.uploadImage(
        image.path,
        image.originalname,
        `disease-detection` // Folder in ImageKit
      );
      if (!uploadResponse.url || !uploadResponse.fileId) {
        throw new Error('ImageKit upload failed: Missing URL or File ID.');
      }
      return {
        url: uploadResponse.url,
        id: uploadResponse.fileId,
      };
    } catch (error) {
      this.logger.logError(error as Error, 'Error uploading image to ImageKit.');
      throw new Error(`Image upload failed: ${(error as Error).message || 'Unknown error'}`); // Re-throw more generic error
    }
  }

  /**
   * Creates a new entry in the disease detection history.
   * @param userId - ID of the user.
   * @param cropName - Name of the crop.
   * @param description - Description of the disease.
   * @param image - The uploaded image file (Multer).
   * @param detectedDiseaseId - ID of the detected disease.
   * @param session - Mongoose client session for transactions.
   * @returns Partial history object for logging.
   */
  private async createNewHistory(
    userId: string,
    cropName: string,
    description: string | undefined,
    image: Express.Multer.File,
    detectedDiseaseId: string,
    session: mongoose.ClientSession
  ): Promise<Pick<IDiseaseDetectionHistory, 'userId' | 'cropName' | 'description' | 'image'>> {
    let uploadedImageData: { url: string; id: string } | undefined;
    try {
      uploadedImageData = await this.uploadImage(image); // Upload to ImageKit
      // Cleanup temporary local file immediately after successful cloud upload
      await this.uploadUtil.deleteFile(image.path);

      const newHistoryEntry = await this.diseaseDetectionModelHistory.create(
        [
          {
            userId,
            cropName,
            description,
            detectedDisease: {
              status: 'success',
              id: detectedDiseaseId,
            },
            image: uploadedImageData,
          },
        ],
        { session } // Attach session to create operation
      );

      if (!newHistoryEntry || newHistoryEntry.length === 0) {
        throw new Error('Failed to create disease history record.');
      }
      this.logger.info(
        `New disease history created for user: ${userId}, disease: ${detectedDiseaseId}`
      );
      return {
        userId: newHistoryEntry[0].userId,
        cropName: newHistoryEntry[0].cropName,
        description: newHistoryEntry[0].description,
        image: newHistoryEntry[0].image,
      };
    } catch (error) {
      // If ImageKit upload succeeded but history creation failed, delete from ImageKit
      if (uploadedImageData?.id) {
        await imageKitUtil.deleteImage(uploadedImageData.id);
        this.logger.warn(
          `Cleaned up ImageKit file ${uploadedImageData.id} due to history creation failure.`
        );
      }
      this.logger.logError(error as Error, 'Error creating new disease history.');
      throw error; // Re-throw for transaction rollback
    }
  }

  /**
   * Generates full disease details (symptoms, treatment etc.) for a newly detected disease using Gemini.
   * @param diseaseName - The name of the detected disease.
   * @param cropName - The name of the crop.
   * @param description - Optional description.
   * @returns Parsed disease details.
   */
  private async generateFullDetailsOfNewDetectedDisease(
    diseaseName: string,
    cropName: string,
    description?: string
  ): Promise<OutputDetectDisease> {
    try {
      const prompt = DiseaseDetectionPrompt.getNewDiseaseDetectionGeneratingPrompt(
        diseaseName,
        cropName,
        description
      );
      const newDetailsJson = await this.gemini.generateResponse(prompt);
      if (!newDetailsJson) {
        throw new Error('Gemini failed to generate disease details response.');
      }

      const parsedData: OutputDetectDisease = JSON.parse(newDetailsJson);
      // Basic validation for parsed data structure (optional but good practice)
      if (!parsedData.diseaseName || !parsedData.symptoms || !parsedData.treatment) {
        throw new Error('Generated disease details are incomplete or invalid.');
      }
      return parsedData;
    } catch (error) {
      this.logger.logError(
        error as Error,
        'Error generating full details of new detected disease.'
      );
      throw new Error(
        `Failed to generate disease details: ${(error as Error).message || 'Invalid Gemini response.'}`
      ); // Re-throw specific error
    }
  }

  /**
   * Helper to map `OutputDetectDisease` to `DiseaseDetectionResultPayload` for socket emission.
   * @param data - OutputDetectDisease object.
   * @param cropName - The crop name associated with the detection.
   * @returns Formatted payload for socket emission.
   */
  private mapToResultPayload(
    data: OutputDetectDisease,
    cropName: string
  ): DiseaseDetectionResultPayload {
    return {
      cropName: cropName, // Use the provided cropName from input
      diseaseName: data.diseaseName,
      description: data.description || 'No specific description provided.',
      symptoms: data.symptoms || [],
      treatment: data.treatment || [],
      causes: data.causes || [],
      preventiveTips: data.preventiveTips || [],
    };
  }

  /**
   * Helper to tokenize a string for search.
   * @param text - The input string.
   * @returns Array of lowercase alphanumeric tokens.
   */
  static tokenize(text: string): string[] {
    return text.toLowerCase().match(/\w+/g) || [];
  }
}

// ---
// Example of how to initialize and use the service in your main application file (e.g., `src/app.ts` or `src/server.ts`)
// ---

/*
// Assuming you have these initialized somewhere in your main app.
// If you're using a DI container, it would manage this.
import { Server as SocketIOServer } from 'socket.io';
import { ImageKitUtil } from './utils/imageKit.util';
import { Logger } from './utils/logger';
import GeminiUtils from './utils/gemini.utils';
import { FileUploadUtil } from './utils/multer.util';
import { DiseaseDetectionSocketHandler } from './services/socket.service'; // Adjust path

// Initialize core singletons/dependencies once
const imageKitUtil = new ImageKitUtil(); // ImageKitUtil might also be a singleton
const logger = Logger.getInstance('GLOBAL_APP_LOGGER');
const geminiUtils = new GeminiUtils();

// Initialize Multer Utility as a singleton (if not already done in routes)
// Ensure this matches the config used in your routes for temp-uploads
const fileUploadUtil = FileUploadUtil.getInstance(
  './uploads/temp-detection-images',
  5,
  ['image/jpeg', 'image/png', 'image/jpg']
);

// Initialize Socket.IO server (assuming it's already done in your main app)
// const io = new SocketIOServer(httpServer); // Pass your HTTP server instance
// const diseaseDetectionSocketHandler = new DiseaseDetectionSocketHandler(io);

// Initialize the DiseaseDetectionService with injected dependencies
// const diseaseDetectionService = new DiseaseDetectionService(
//   imageKitUtil,
//   logger,
//   geminiUtils,
//   fileUploadUtil,
//   diseaseDetectionSocketHandler
// );

// Now you can use diseaseDetectionService in your controller:
// diseaseDetectionController.detectDisease(req, res, next, diseaseDetectionService);
*/
