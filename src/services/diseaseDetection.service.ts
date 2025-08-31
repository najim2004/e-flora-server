import { imageKitUtil } from '../utils/imageKit.util';
import { DiseaseDetection } from '../models/diseaseDetection.model';
import { DiseaseDetectionHistory } from '../models/diseaseDetectionHistory.model';
import Logger from '../utils/logger';
import {
  DiseaseDetectionStatus,
  InputDetectDisease,
  OutputDetectDisease,
} from '../types/diseaseDetection.type';
import { DiseaseDetectionPrompt } from '../prompts/diseaseDetection.prompt';
import GeminiUtils, { gemini } from '../utils/gemini.utils';
import { FileUploadUtil } from '../utils/multer.util';
import mongoose, { PipelineStage, Types } from 'mongoose';
import { IDiseaseDetectionHistory } from '../interfaces/diseaseDetectionHistory.interface';
import { SocketServer } from '../socket.server';
import { IDiseaseDetection } from '../interfaces/diseaseDetection.interface';
import { DiseaseDetectionSocketHandler } from '../socket/diseaseDetection.socket';
import { Image } from '../models/image.model';
import { Garden } from '../models/garden.model';
import { GardenCrop } from '../models/gardenCrop.model';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export class DiseaseDetectionService {
  private logger: Logger;
  private gemini = gemini;
  private uploader: FileUploadUtil;
  private socket: SocketServer;

  constructor() {
    this.logger = Logger.getInstance('DiseaseDetection');
    this.uploader = new FileUploadUtil('temp-uploads', 5, ['image/jpeg', 'image/png', 'image/jpg']);
    this.socket = SocketServer.getInstance();
  }

  /**
   * Orchestrates the entire disease detection process.
   * It handles two main modes: 'MANUAL' for direct user input and 'GARDEN_CROP' for crops from a user's garden.
   * The method validates the input, calls the AI for detection, saves the results, and manages the process within a database transaction.
   * @param input - The structured input data from the controller.
   */
  public async detectDisease(input: InputDetectDisease): Promise<void> {
    const { userId, image, mode, description } = input;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      this.emitProgress(userId, 'initiated', 5, 'Starting detection process...');

      let cropName: string;
      let gardenId: string | undefined;
      let gardenCropId: string | undefined;

      // The logic block to handle different detection modes.
      if (mode === 'GARDEN_CROP') {
        if (!input.gardenCropId)
          throw new BadRequestError('gardenCropId is required for GARDEN_CROP mode');

        // For garden crops, we perform a series of explicit checks to ensure data integrity and authorization.
        // Step 1: Find the user's garden to confirm they have one.
        const garden = await Garden.findOne({ userId: new Types.ObjectId(userId) }).session(session);
        if (!garden) throw new UnauthorizedError('User does not have a garden.');

        // Step 2: Find the specific crop instance.
        const gardenCrop = await GardenCrop.findById(input.gardenCropId).session(session);
        if (!gardenCrop) throw new BadRequestError('Garden crop not found.');

        // Step 3: Explicitly validate that the crop belongs to the user's garden.
        if (gardenCrop.garden.toString() !== garden._id.toString()) {
          throw new UnauthorizedError('This crop does not belong to your garden.');
        }

        // Step 4: Ensure the crop is in a valid state for detection.
        if (gardenCrop.status === 'pending' || gardenCrop.status === 'removed') {
          throw new BadRequestError(
            `Cannot perform detection on a crop with status: ${gardenCrop.status}`
          );
        }

        // If all checks pass, assign variables for the main detection process.
        cropName = gardenCrop.cropName;
        gardenId = garden._id.toString();
        gardenCropId = gardenCrop._id.toString();
      } else if (mode === 'MANUAL') {
        if (!input.cropName) throw new BadRequestError('cropName is required for MANUAL mode');
        cropName = input.cropName;
      } else {
        throw new BadRequestError('Invalid detection mode specified.');
      }

      // The core AI-driven detection logic begins here.
      this.emitProgress(userId, 'analyzing', 20, 'Analyzing image...');
      const { diseaseName, embedded } = await this.detectAndEmbed(cropName, image, description);

      // Find an existing disease entry or create a new one to avoid duplicates.
      const match = await this.findOrCreateDisease(
        userId,
        diseaseName,
        embedded,
        cropName,
        description,
        session
      );

      // Save the detection event to the user's history.
      this.emitProgress(userId, 'savingToDB', 80, 'Saving detection history...');
      const history = await this.addHistory(
        userId,
        cropName,
        description,
        image,
        match._id,
        session,
        gardenId,
        gardenCropId
      );

      // Finalize the process by committing the transaction and cleaning up.
      await this.finalize(userId, image.path, history, session, 'Detection completed.');
    } catch (e) {
      // In case of any error, abort the transaction and notify the user.
      await session.abortTransaction();
      this.logger.logError(e as Error, `Detection failed for ${userId}`);
      this.socketHndlr().emitError(userId, `Failed: ${(e as Error).message}`);
      if (image?.path) this.uploader.deleteFile(image.path);
    } finally {
      session.endSession();
    }
  }

  /**
   * Finds an existing disease based on vector similarity or creates a new entry if none is found.
   * This prevents duplicate disease details in the database.
   * @returns A promise that resolves to the found or newly created disease document.
   */
  private async findOrCreateDisease(
    userId: string,
    diseaseName: string,
    embedded: number[],
    cropName: string,
    description: string | undefined,
    session: mongoose.ClientSession
  ): Promise<IDiseaseDetection> {
    // First, attempt to find a similar disease by its vector embedding.
    const existing = await this.getByEmbedding(diseaseName, embedded, session);
    if (existing) return existing;

    // If no similar disease is found, generate full details using the AI and create a new record.
    this.emitProgress(userId, 'generatingData', 60, 'Generating new disease details...');
    const newDetails = await this.generateDetails(diseaseName, cropName, description);
    const [saved] = await DiseaseDetection.create([{ ...newDetails, embedded }], { session });
    return saved;
  }

  /**
   * Interacts with the Gemini API to analyze an image and return the disease name and its vector embedding.
   * @returns A promise that resolves to the disease name and its embedding.
   */
  private async detectAndEmbed(
    name: string,
    img: Express.Multer.File,
    desc?: string
  ): Promise<{ diseaseName: string; embedded: number[] }> {
    const prompt = DiseaseDetectionPrompt.getDiseaseNameGettingPrompt(name, desc);
    const disease = await this.gemini.generateResponseWithImage(prompt, {
      imageFile: { path: img.path, mimeType: img.mimetype },
    });
    if (!disease || ['ERROR_INVALID_IMAGE', 'NO_DISEASE_DETECTED'].includes(disease))
      throw new Error('Invalid image or no disease.');

    // Generate a vector embedding for the detected disease name for similarity searches.
    const embedded = await this.gemini.generateEmbedding(disease);
    if (!embedded.length) throw new Error('Embedding failed.');
    return { diseaseName: disease, embedded };
  }

  private async generateDetails(
    name: string,
    crop: string,
    desc?: string
  ): Promise<OutputDetectDisease> {
    let raw = await this.gemini.generateResponse(
      DiseaseDetectionPrompt.getNewDiseaseDetectionGeneratingPrompt(name, crop, desc)
    );
    if (!raw) throw new Error('AI failed to generate details.');

    raw = raw
      .trim()
      .replace(/^```json?n?/, '')
      .replace(/```$/, '')
      .trim();
    const parsed = JSON.parse(raw);
    if (!parsed.diseaseName || !parsed.symptoms || !parsed.treatment)
      throw new Error('Incomplete AI data.');
    return parsed;
  }

  private async getByEmbedding(
    name: string,
    embed: number[],
    session: mongoose.ClientSession
  ): Promise<IDiseaseDetection | null> {
    const results = await DiseaseDetectionService.search(name, session);
    return DiseaseDetectionService.findBestMatch(results, embed);
  }

  /**
   * Saves the record of the detection event to the user's history.
   * This includes uploading the user's image to a persistent cloud store (ImageKit).
   * @returns A promise that resolves to the created history document.
   */
  private async addHistory(
    userId: string,
    crop: string,
    desc: string | undefined,
    img: Express.Multer.File,
    diseaseId: Types.ObjectId,
    session: mongoose.ClientSession,
    gardenId?: string,
    gardenCropId?: string
  ): Promise<IDiseaseDetectionHistory> {
    // Upload the image to ImageKit for long-term storage.
    const uploaded = await this.uploadImage(img);
    // The temporary local file can be deleted after successful upload.
    this.uploader.deleteFile(img.path);
    const [imageDoc] = await Image.create(
      [{ url: uploaded.url, imageId: uploaded.id, index: 'disease' }],
      { session }
    );

    const [history] = await DiseaseDetectionHistory.create(
      [
        {
          userId: new Types.ObjectId(userId),
          cropName: crop,
          description: desc,
          detectedDisease: diseaseId,
          image: imageDoc._id,
          // The 'cta' (Call To Action) field is enabled if the detection is linked to a garden crop.
          cta: !!(gardenId && gardenCropId),
          ...(gardenId &&
            gardenCropId && {
              gardenId: new Types.ObjectId(gardenId),
              gardenCropId: new Types.ObjectId(gardenCropId),
            }),
        },
      ],
      { session }
    );

    return history;
  }

  private async uploadImage(image: Express.Multer.File): Promise<{ url: string; id: string }> {
    const res = await imageKitUtil.uploadImage(image.path, image.originalname, 'disease-detection');
    if (!res.url || !res.fileId) throw new Error('Upload failed.');
    return { url: res.url, id: res.fileId };
  }

  private async finalize(
    userId: string,
    path: string,
    history: IDiseaseDetectionHistory,
    session: mongoose.ClientSession,
    message: string
  ): Promise<void> {
    await session.commitTransaction();
    this.uploader.deleteFile(path);
    this.emitProgress(userId, 'completed', 100, message);
    this.socketHndlr().emitFinalResult(userId, { resultId: history._id.toString() });
  }

  private emitProgress(
    userId: string,
    status: DiseaseDetectionStatus,
    progress: number,
    message: string
  ): Promise<void> {
    return this.socketHndlr().emitProgressUpdate({ userId, status, progress, message });
  }

  private socketHndlr(): DiseaseDetectionSocketHandler {
    return this.socket.diseaseDetection();
  }

  static async search(
    query: string,
    session: mongoose.ClientSession
  ): Promise<Partial<IDiseaseDetection>[]> {
    const tokens = query.toLowerCase().split(/s+/);
    if (!tokens.length) return [];

    const $or = tokens.flatMap(t => [
      { diseaseName: { $regex: t, $options: 'i' } },
      { cropName: { $regex: t, $options: 'i' } },
      { description: { $regex: t, $options: 'i' } },
      ...['symptoms', 'causes', 'treatment', 'preventiveTips'].map(f => ({
        [f]: { $elemMatch: { $regex: t, $options: 'i' } },
      })),
    ]);

    const concatFields = [
      { $ifNull: ['$diseaseName', ''] },
      ' ',
      { $ifNull: ['$cropName', ''] },
      ' ',
      { $ifNull: ['$description', ''] },
      ' ',
      ...['symptoms', 'causes', 'treatment', 'preventiveTips'].map(f => ({
        $reduce: {
          input: { $ifNull: [`$${f}`, []] },
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
            $sum: tokens.map(t => ({
              $cond: [
                { $regexMatch: { input: { $concat: concatFields }, regex: t, options: 'i' } },
                1,
                0,
              ],
            })),
          },
        },
      },
      { $match: { matchScore: { $gt: 0 } } },
      { $sort: { matchScore: -1 } },
      { $project: { matchScore: 0, __v: 0, createdAt: 0, updatedAt: 0 } },
    ];

    return DiseaseDetection.aggregate(aggregation).session(session).exec();
  }

  private static findBestMatch(
    data: Partial<IDiseaseDetection>[],
    query: number[],
    threshold = 0.8
  ): IDiseaseDetection | null {
    const best = data.reduce<{ doc: Partial<IDiseaseDetection> | null; score: number }>(
      (acc, curr) => {
        const score = GeminiUtils.calculateCosineSimilarity(query, curr.embedded || []);
        return score > acc.score ? { doc: curr, score } : acc;
      },
      { doc: null, score: -Infinity }
    );
    return best.score >= threshold ? (best.doc as IDiseaseDetection) : null;
  }

  public async getSingleResult(
    userId: string,
    historyId: string
  ): Promise<IDiseaseDetectionHistory | null> {
    if (!Types.ObjectId.isValid(historyId)) return null;
    return DiseaseDetectionHistory.findOne({ _id: historyId, userId })
      .select('-__v -createdAt -updatedAt -cacheKey -userId')
      .populate({ path: 'detectedDisease.id', select: '-__v -createdAt -updatedAt -embedded' })
      .exec();
  }

  public async getPaginatedHistory(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<{ total: number; histories: IDiseaseDetectionHistory[] }> {
    const skip = (page - 1) * limit;
    const [total, histories] = await Promise.all([
      DiseaseDetectionHistory.countDocuments({ userId }),
      DiseaseDetectionHistory.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'detectedDisease.id', select: '-__v -createdAt -updatedAt -embedded' })
        .exec(),
    ]);
    return { total, histories };
  }
}
