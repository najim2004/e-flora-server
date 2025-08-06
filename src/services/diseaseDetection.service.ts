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

  public async detectDisease(input: InputDetectDisease): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    const { userId, image, description, cropName, cropId, gardenId } = input;
    let uploadedId: string | undefined;

    try {
      this.emitProgress(userId, 'initiated', 5, 'Starting detection process...');
      this.emitProgress(userId, 'analyzing', 20, 'Analyzing image and generating embeddings...');

      const { diseaseName, embedded } = await this.detectAndEmbed(cropName, image, description);
      const match = await this.findOrCreateDisease(
        diseaseName,
        embedded,
        cropName,
        description,
        session
      );

      this.emitProgress(userId, 'savingToDB', 80, 'Saving detection history...');
      const history = await this.addHistory(
        userId,
        cropName,
        description,
        image,
        match._id,
        session,
        gardenId,
        cropId
      );
      await this.finalize(userId, image.path, history, session, 'Detection completed.');
    } catch (e) {
      await session.abortTransaction();
      this.logger.logError(e as Error, `Detection failed for ${userId}, ${cropName}`);
      this.socketHndlr().emitError(userId, `Failed: ${(e as Error).message}`);
      if (image?.path) this.uploader.deleteFile(image.path);
      if (uploadedId) await imageKitUtil.deleteImage(uploadedId);
    } finally {
      session.endSession();
    }
  }

  private async findOrCreateDisease(
    diseaseName: string,
    embedded: number[],
    cropName: string,
    description: string | undefined,
    session: mongoose.ClientSession
  ): Promise<IDiseaseDetection> {
    const existing = await this.getByEmbedding(diseaseName, embedded, session);
    if (existing) return existing;

    this.emitProgress('', 'generatingData', 60, 'Generating new disease details...');
    const newDetails = await this.generateDetails(diseaseName, cropName, description);
    const [saved] = await DiseaseDetection.create([{ ...newDetails, embedded }], { session });
    return saved;
  }

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
      .replace(/^```json?\n?/, '')
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

  private async addHistory(
    userId: string,
    crop: string,
    desc: string | undefined,
    img: Express.Multer.File,
    diseaseId: Types.ObjectId,
    session: mongoose.ClientSession,
    gardenId?: string,
    cropId?: string
  ): Promise<IDiseaseDetectionHistory> {
    const uploaded = await this.uploadImage(img);
    this.uploader.deleteFile(img.path);
    const [imageDoc] = await Image.create(
      [{ url: uploaded.url, imageId: uploaded.id, index: 'disease' }],
      { session }
    );

    const history = await DiseaseDetectionHistory.create(
      [
        {
          userId: new Types.ObjectId(userId),
          cropName: crop,
          description: desc,
          detectedDisease: diseaseId,
          image: imageDoc._id,
          cta: !!(gardenId && cropId),
          ...(gardenId &&
            cropId && { garden: new Types.ObjectId(gardenId), crop: new Types.ObjectId(cropId) }),
        },
      ],
      { session }
    );

    return history[0];
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
    const tokens = query.toLowerCase().split(/\s+/);
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
