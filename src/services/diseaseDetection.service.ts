import { imageKitUtil } from '../utils/imageKit.util';
import { DiseaseDetection } from '../models/diseaseDetection.model';
import { DiseaseDetectionHistory } from '../models/diseaseDetectionHistory.model';
import Logger from '../utils/logger';
import {
  DiseaseDetectionResultPayload,
  InputDetectDisease,
  OutputDetectDisease,
} from '../types/diseaseDetection.type';
import { DiseaseDetectionPrompt } from '../prompts/diseaseDetection.prompt';
import GeminiUtils, { gemini } from '../utils/gemini.utils';
import { FileUploadUtil } from '../utils/multer.util';
import mongoose, { ObjectId, PipelineStage } from 'mongoose';
import { IDiseaseDetectionHistory } from '../interfaces/diseaseDetectionHistory.interface';
import { SocketServer } from '../socket.server';
import { IDiseaseDetection } from '../interfaces/diseaseDetection.interface';

export class DiseaseDetectionService {
  private diseaseDetectionModel = DiseaseDetection;
  private diseaseDetectionModelHistory = DiseaseDetectionHistory;
  private logger: Logger;
  private gemini = gemini;
  private uploadUtil: FileUploadUtil;
  private socketHandler: SocketServer;

  private static prompts = DiseaseDetectionPrompt;

  constructor() {
    this.logger = Logger.getInstance('DiseaseDetection');
    this.uploadUtil = new FileUploadUtil('temp-uploads', 5, [
      'image/jpeg',
      'image/png',
      'image/jpg',
    ]);
    this.socketHandler = SocketServer.getInstance();
  }

  public async detectDisease(input: InputDetectDisease): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    const { userId, cropName, description, image } = input;
    let uploadedFileId: string | undefined;

    try {
      // Step 1: Initialize and emit progress
      this.socketHandler.diseaseDetection().emitProgressUpdate({
        userId,
        status: 'initiated',
        progress: 5,
        message: 'Starting detection process...',
      });
      this.logger.debug(`Step 1: Detection initiated for user: ${userId}, crop: ${cropName}`);

      // Step 2: Check for existing successful detection history by cropName
      const existingDetectionByCropName = await this.getDiseaseDetailsByCropName(cropName, session);
      if (existingDetectionByCropName) {
        this.logger.debug(
          `Step 2: Existing detection found by crop name for user: ${userId}, crop: ${cropName}`
        );
        const newHistory = await this.createNewHistory(
          userId,
          cropName,
          description,
          image,
          existingDetectionByCropName._id,
          session
        );
        await session.commitTransaction();
        this.socketHandler.diseaseDetection().emitProgressUpdate({
          userId,
          status: 'completed',
          progress: 100,
          message: 'Detection completed using existing data.',
        });
        this.uploadUtil.deleteFile(image.path);
        this.socketHandler
          .diseaseDetection()
          .emitFinalResult(
            userId,
            this.mapToResultPayload(existingDetectionByCropName, newHistory)
          );
        return;
      }

      // Step 3: Analyze image and generate embeddings
      this.socketHandler.diseaseDetection().emitProgressUpdate({
        userId,
        status: 'analyzing',
        progress: 20,
        message: 'Analyzing image and generating embeddings...',
      });
      this.logger.debug(
        `Step 3: No existing detection by crop name. Analyzing image for ${cropName}.`
      );

      const { diseaseName, embedded } = await this.detectDiseaseAndMakeNewEmbedding(
        cropName,
        image,
        description
      );
      if (!embedded || !diseaseName || embedded.length === 0) {
        throw new Error('Failed to detect disease name or generate embedding from AI.');
      }
      this.logger.debug(`Step 3: Disease name detected: "${diseaseName}" for crop: ${cropName}`);

      // Step 4: Check for existing disease based on generated embedding (semantic search)
      const existingDetectionByEmbedding = await this.getDiseaseDetailsByEmbedding(
        diseaseName,
        embedded,
        session
      );
      if (existingDetectionByEmbedding) {
        this.logger.debug(
          `Step 4: Existing detection found by embedding for user: ${userId}, disease: ${diseaseName}`
        );
        const newHistory = await this.createNewHistory(
          userId,
          cropName,
          description,
          image,
          existingDetectionByEmbedding._id,
          session
        );
        await session.commitTransaction();
        this.socketHandler.diseaseDetection().emitProgressUpdate({
          userId,
          status: 'completed',
          progress: 100,
          message: 'Detection completed using existing embedded data.',
        });
        this.uploadUtil.deleteFile(image.path);
        this.socketHandler
          .diseaseDetection()
          .emitFinalResult(
            userId,
            this.mapToResultPayload(existingDetectionByEmbedding, newHistory)
          );
        return;
      }

      // Step 5: Generate full details for a new detected disease
      this.socketHandler.diseaseDetection().emitProgressUpdate({
        userId,
        status: 'generatingData',
        progress: 60,
        message: 'Generating new disease details...',
      });
      this.logger.debug(
        `Step 5: No existing detection by embedding. Generating new details for ${diseaseName}.`
      );

      const newDiseaseDetails = await this.generateFullDetailsOfNewDetectedDisease(
        diseaseName,
        cropName,
        description
      );
      this.logger.debug(`Step 5: Generated new disease details for: ${diseaseName}`);

      // Step 6: Save the new disease details to the main Disease Detection Model
      const savedNewDisease = await this.diseaseDetectionModel.create(
        [{ ...newDiseaseDetails, embedded }],
        { session }
      );
      if (!savedNewDisease || savedNewDisease.length === 0) {
        throw new Error('Failed to save new disease details to database.');
      }
      const newDiseaseId = savedNewDisease[0]._id;
      this.logger.debug(`Step 6: New disease details saved with ID: ${newDiseaseId}`);

      // Step 7: Create a new history entry
      this.socketHandler.diseaseDetection().emitProgressUpdate({
        userId,
        status: 'savingToDB',
        progress: 80,
        message: 'Saving detection history...',
      });
      this.logger.debug(
        `Step 7: Creating new history entry for ${userId} with disease ID ${newDiseaseId}.`
      );

      const newHistory = await this.createNewHistory(
        userId,
        cropName,
        description,
        image,
        newDiseaseId,
        session
      );
      await session.commitTransaction();

      // Step 8: Finalize and emit result
      this.socketHandler.diseaseDetection().emitProgressUpdate({
        userId,
        status: 'completed',
        progress: 100,
        message: 'New disease detected and history saved.',
      });
      this.uploadUtil.deleteFile(image.path);
      this.socketHandler
        .diseaseDetection()
        .emitFinalResult(userId, this.mapToResultPayload(savedNewDisease[0], newHistory));
      this.logger.debug(`Step 8: Detection completed successfully for user: ${userId}.`);
      return;
    } catch (error) {
      await session.abortTransaction();
      this.logger.logError(
        error as Error,
        `Detection failed for user ${userId} and crop ${cropName}`
      );
      this.socketHandler
        .diseaseDetection()
        .emitError(
          userId,
          `Disease detection failed: ${(error as Error).message || 'Unknown error'}`
        );

      if (image?.path) {
        this.uploadUtil.deleteFile(image.path);
      }
      if (uploadedFileId) {
        await imageKitUtil.deleteImage(uploadedFileId);
      }
    } finally {
      session.endSession();
    }
  }

  private async getDiseaseDetailsByCropName(
    cropName: string,
    session: mongoose.ClientSession
  ): Promise<IDiseaseDetection | null> {
    this.logger.debug(`Checking for existing disease details by crop name: ${cropName}`);
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
      .session(session)
      .exec();

    if (history?.detectedDisease?.id) {
      this.logger.debug(`Found disease details in history for crop: ${cropName}`);
      return history.detectedDisease.id as IDiseaseDetection;
    }

    const detectedDisease = await this.diseaseDetectionModel
      .findOne({ cropName })
      .select('-__v -createdAt -updatedAt -embedded')
      .session(session)
      .exec();

    if (detectedDisease) {
      this.logger.debug(`Found disease details in main model for crop: ${cropName}`);
    } else {
      this.logger.debug(`No existing disease details found for crop: ${cropName}`);
    }
    return detectedDisease;
  }

  private async detectDiseaseAndMakeNewEmbedding(
    cropName: string,
    image: Express.Multer.File,
    description?: string
  ): Promise<{ diseaseName: string; embedded: number[] }> {
    this.logger.debug(`Detecting disease name and generating embedding for crop: ${cropName}`);
    try {
      const prompt = DiseaseDetectionService.prompts.getDiseaseNameGettingPrompt(
        cropName,
        description
      );
      const detectedDiseaseName = await this.gemini.generateResponseWithImage(prompt, {
        path: image.path,
        mimeType: image.mimetype,
      });

      if (!detectedDiseaseName || detectedDiseaseName === 'ERROR_INVALID_IMAGE') {
        throw new Error('Image processing failed or invalid image.');
      } else if (detectedDiseaseName === 'NO_DISEASE_DETECTED') {
        throw new Error('No specific disease detected for the provided image and description.');
      }

      const generatedEmbedding = await this.gemini.generateEmbedding(detectedDiseaseName);
      if (!generatedEmbedding || generatedEmbedding.length === 0) {
        throw new Error('Failed to generate embedding for the detected disease name.');
      }
      this.logger.debug(`Disease name "${detectedDiseaseName}" detected and embedding generated.`);
      return { diseaseName: detectedDiseaseName, embedded: generatedEmbedding };
    } catch (error) {
      this.logger.logError(
        error as Error,
        'Error during Gemini AI interaction for disease detection/embedding.'
      );
      throw error;
    }
  }

  private async getDiseaseDetailsByEmbedding(
    diseaseName: string,
    queryEmbedding: number[],
    session: mongoose.ClientSession
  ): Promise<IDiseaseDetection | null> {
    this.logger.debug(`Searching for existing disease by embedding for disease: ${diseaseName}`);
    try {
      const allDetectedDiseaseWithRelatedThisKeyWord = await DiseaseDetectionService.search(
        diseaseName,
        session
      );
      this.logger.debug(
        `Search returned ${allDetectedDiseaseWithRelatedThisKeyWord?.length} results.`
      );
      if (allDetectedDiseaseWithRelatedThisKeyWord.length > 0) {
        const bestMatchedDisease = DiseaseDetectionService.findBestMatch(
          allDetectedDiseaseWithRelatedThisKeyWord,
          queryEmbedding
        );
        if (bestMatchedDisease) {
          this.logger.debug(`Best match found by embedding: ${bestMatchedDisease.diseaseName}`);
        } else {
          this.logger.debug('No sufficiently similar disease found by embedding.');
        }
        return bestMatchedDisease;
      }
      this.logger.debug('No related keywords found for embedding search.');
      return null;
    } catch (error) {
      this.logger.logError(error as Error, 'Error checking existing disease with embedded data.');
      throw error;
    }
  }

  private static findBestMatch(
    dataArray: IDiseaseDetection[],
    queryEmbedding: number[]
  ): IDiseaseDetection | null {
    if (!dataArray.length) return null;

    let bestMatch: IDiseaseDetection | null = null;
    let bestScore = -Infinity;

    for (const data of dataArray) {
      if (!data.embedded || data.embedded.length !== queryEmbedding.length) continue;
      const score = GeminiUtils.calculateCosineSimilarity(queryEmbedding, data.embedded);
      Logger.getInstance('DiseaseDetection').debug(
        `Cosine similarity score for "${data.diseaseName}": ${score}`
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = data;
      }
    }
    return bestMatch;
  }

  static async search(
    query: string,
    session: mongoose.ClientSession
  ): Promise<IDiseaseDetection[]> {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) {
      Logger.getInstance('DiseaseDetection').debug('No tokens to search for.');
      return [];
    }
    Logger.getInstance('DiseaseDetection').debug(`Searching with tokens: ${tokens.join(', ')}`);

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

    const result = await DiseaseDetection.aggregate(aggregation).session(session);
    return result;
  }

  private async uploadImage(image: Express.Multer.File): Promise<{ url: string; id: string }> {
    this.logger.debug(`Attempting to upload image: ${image.originalname}`);
    try {
      const uploadResponse = await imageKitUtil.uploadImage(
        image.path,
        image.originalname,
        `disease-detection`
      );
      if (!uploadResponse.url || !uploadResponse.fileId) {
        throw new Error('ImageKit upload failed: Missing URL or File ID.');
      }
      this.logger.debug(`Image uploaded to ImageKit. URL: ${uploadResponse.url}`);
      return {
        url: uploadResponse.url,
        id: uploadResponse.fileId,
      };
    } catch (error) {
      this.logger.logError(error as Error, 'Error uploading image to ImageKit.');
      throw new Error(`Image upload failed: ${(error as Error).message || 'Unknown error'}`);
    }
  }

  private async createNewHistory(
    userId: string,
    cropName: string,
    description: string | undefined,
    image: Express.Multer.File,
    detectedDiseaseId: ObjectId,
    session: mongoose.ClientSession
  ): Promise<IDiseaseDetectionHistory> {
    this.logger.debug(
      `Creating new history entry for user: ${userId}, disease ID: ${detectedDiseaseId}`
    );
    let uploadedImageData: { url: string; id: string } | undefined;
    try {
      uploadedImageData = await this.uploadImage(image);
      this.uploadUtil.deleteFile(image.path);

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
        { session }
      );

      if (!newHistoryEntry || newHistoryEntry.length === 0) {
        throw new Error('Failed to create disease history record.');
      }
      this.logger.debug(
        `New disease history created for user: ${userId}, disease: ${detectedDiseaseId}`
      );
      return newHistoryEntry[0];
    } catch (error) {
      if (uploadedImageData?.id) {
        await imageKitUtil.deleteImage(uploadedImageData.id);
        this.logger.warn(
          `Cleaned up ImageKit file ${uploadedImageData.id} due to history creation failure.`
        );
      }
      this.logger.logError(error as Error, 'Error creating new disease history.');
      throw error;
    }
  }

  private async generateFullDetailsOfNewDetectedDisease(
    diseaseName: string,
    cropName: string,
    description?: string
  ): Promise<OutputDetectDisease> {
    this.logger.debug(`Generating full details for new disease: ${diseaseName}`);
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
      if (!parsedData.diseaseName || !parsedData.symptoms || !parsedData.treatment) {
        throw new Error('Generated disease details are incomplete or invalid.');
      }
      this.logger.debug(`Successfully generated full details for ${diseaseName}.`);
      return parsedData;
    } catch (error) {
      this.logger.logError(
        error as Error,
        'Error generating full details of new detected disease.'
      );
      throw new Error(
        `Failed to generate disease details: ${(error as Error).message || 'Invalid Gemini response.'}`
      );
    }
  }

  private mapToResultPayload(
    diseaseDetails: IDiseaseDetection,
    diseaseHistory: IDiseaseDetectionHistory
  ): DiseaseDetectionResultPayload {
    return {
      _id: diseaseHistory._id.toString(),
      image: diseaseHistory.image,
      description: diseaseHistory.description,
      cropName: diseaseHistory.cropName,
      diseaseDetails: {
        _id: diseaseDetails._id.toString(),
        cropName: diseaseDetails.cropName,
        diseaseName: diseaseDetails.diseaseName,
        description: diseaseDetails.description || 'No specific description provided.',
        symptoms: diseaseDetails.symptoms || [],
        treatment: diseaseDetails.treatment || [],
        causes: diseaseDetails.causes || [],
        preventiveTips: diseaseDetails.preventiveTips || [],
      },
    };
  }

  static tokenize(text: string): string[] {
    return text.toLowerCase().match(/\w+/g) || [];
  }

  // Fetch Specific Detection History

  public async getDetectionHistoryResult(
    userId: string,
    historyId: string
  ): Promise<DiseaseDetectionResultPayload | null> {
    this.logger.debug(`Fetching history for user: ${userId}, history ID: ${historyId}`);
    try {
      const historyEntry = await this.diseaseDetectionModelHistory
        .findOne({ _id: historyId, userId })
        .populate({
          path: 'detectedDisease.id',
          select: '-__v -createdAt -updatedAt -embedded',
        })
        .exec();

      if (!historyEntry) {
        this.logger.warn(`No history found for user ${userId} with history ID ${historyId}`);
        return null;
      }

      if (historyEntry.detectedDisease.status === 'success' && historyEntry.detectedDisease.id) {
        this.logger.debug(`Found successful history entry for history ID: ${historyId}`);
        return this.mapToResultPayload(
          historyEntry.detectedDisease.id as IDiseaseDetection,
          historyEntry
        );
      }
      this.logger.warn(
        `Disease detection not successful or disease ID missing for history ID ${historyId}`
      );
      return null;
    } catch (error) {
      this.logger.logError(
        error as Error,
        `Error fetching detection history result for user ${userId}, history ID ${historyId}`
      );
      throw new Error(
        `Failed to retrieve detection history: ${(error as Error).message || 'Unknown error'}`
      );
    }
  }

  // Get User Detection History

  public async getUserDetectionHistory(
    userId: string,
    limit: number,
    page: number
  ): Promise<IDiseaseDetectionHistory[]> {
    this.logger.debug(`Fetching history for user: ${userId}, limit: ${limit}, page: ${page}`);
    try {
      const skip = (page - 1) * limit;

      const history = await this.diseaseDetectionModelHistory
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      this.logger.debug(`Found ${history.length} history entries for user: ${userId}`);
      return history as IDiseaseDetectionHistory[];
    } catch (error) {
      this.logger.logError(
        error as Error,
        `Error fetching user detection history for user ${userId}, limit ${limit}, page ${page}`
      );
      throw new Error(
        `Failed to retrieve user history: ${(error as Error).message || 'Unknown error'}`
      );
    }
  }
}
