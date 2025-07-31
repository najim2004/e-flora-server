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
import { GardenCrop } from '../models/gardenCrop.model';

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

    const { userId, image, description } = input;
    let cropName, gardenId, cropId;
    if (input.mode === 'manual') {
      cropName = input.cropName?.trim();
      if (!cropName || !description) {
        throw new Error('Crop name, description are required for manual detection.');
      }
    } else {
      if (!input.cropId || !input.gardenId) {
        throw new Error('Crop ID and Garden ID are required for auto detection.');
      }
      gardenId = input.gardenId;
      cropId = input.cropId;
      const cropDetails = await this.getCropDetailsFromGarden(gardenId, cropId);
      if (!cropDetails) {
        throw new Error('Crop not found in the specified garden.');
      }
      cropName = cropDetails.cropName;
    }
    let uploadedId: string | undefined;

    try {
      this.emitProgress(userId, 'initiated', 5, 'Starting detection process...');

      const byName = await this.getByCropName(cropName, session);
      if (byName)
        return await this.finalize(
          userId,
          image.path,
          await this.addHistory(userId, cropName, description, image, byName._id, session),
          session,
          'Detection completed using existing data.'
        );

      this.emitProgress(userId, 'analyzing', 20, 'Analyzing image and generating embeddings...');
      const { diseaseName, embedded } = await this.detectAndEmbed(cropName, image, description);

      const byEmbed = await this.getByEmbedding(diseaseName, embedded, session);
      if (byEmbed)
        return await this.finalize(
          userId,
          image.path,
          await this.addHistory(userId, cropName, description, image, byEmbed._id, session),
          session,
          'Detection completed using existing embedded data.'
        );

      this.emitProgress(userId, 'generatingData', 60, 'Generating new disease details...');
      const newDetails = await this.generateDetails(diseaseName, cropName, description);
      const [saved] = await DiseaseDetection.create([{ ...newDetails, embedded }], { session });

      this.emitProgress(userId, 'savingToDB', 80, 'Saving detection history...');
      const history = await this.addHistory(
        userId,
        cropName,
        description,
        image,
        saved._id,
        session
      );
      await this.finalize(
        userId,
        image.path,
        history,
        session,
        'New disease detected and history saved.'
      );
    } catch (e) {
      await session.abortTransaction();
      this.logger.logError(e as Error, `Detection failed for ${input.userId}, ${input.cropName}`);
      this.socketHndlr().emitError(input.userId, `Failed: ${(e as Error).message}`);
      if (image?.path) this.uploader.deleteFile(image.path);
      if (uploadedId) await imageKitUtil.deleteImage(uploadedId);
    } finally {
      session.endSession();
    }
  }

  private async getCropDetailsFromGarden(
    gardenId: string,
    cropId: string
  ): Promise<{ cropName: string; createdAt: Date; currentStage: string } | null> {
    const crop = await GardenCrop.findOne({ _id: cropId, garden: gardenId }).select(
      'cropName createdAt currentStage'
    );

    return crop?.toObject();
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

  private async getByCropName(
    name: string,
    session: mongoose.ClientSession
  ): Promise<Pick<
    IDiseaseDetection,
    | '_id'
    | 'cropName'
    | 'description'
    | 'diseaseName'
    | 'symptoms'
    | 'treatment'
    | 'causes'
    | 'preventiveTips'
  > | null> {
    // Check if name contains any invalid terms using regex
    const invalidPattern = /(unknown|n\/?a|null)/i;
    if (!name || invalidPattern.test(name)) {
      return null;
    }

    const h = await DiseaseDetectionHistory.findOne({
      cropName: name,
      'detectedDisease.status': 'success',
    })
      .populate({ path: 'detectedDisease.id', select: '-__v -createdAt -updatedAt -embedded' })
      .session(session)
      .exec();

    return h?.detectedDisease?.id
      ? { ...h?.detectedDisease?.id.toObject(), _id: h?.detectedDisease?.id._id }
      : DiseaseDetection.findOne({ cropName: name })
          .select('-__v -createdAt -updatedAt -embedded')
          .session(session);
  }

  private async detectAndEmbed(
    name: string,
    img: Express.Multer.File,
    desc?: string
  ): Promise<{ diseaseName: string; embedded: number[] }> {
    const prompt = DiseaseDetectionPrompt.getDiseaseNameGettingPrompt(name, desc);
    const disease = await this.gemini.generateResponseWithImage(prompt, {
      path: img.path,
      mimeType: img.mimetype,
    });
    if (!disease || ['ERROR_INVALID_IMAGE', 'NO_DISEASE_DETECTED'].includes(disease))
      throw new Error('Image not valid or no disease detected.');
    const embedded = await this.gemini.generateEmbedding(disease);
    if (!embedded.length) throw new Error('Embedding generation failed.');
    return { diseaseName: disease, embedded };
  }

  private async getByEmbedding(
    name: string,
    embed: number[],
    session: mongoose.ClientSession
  ): Promise<Pick<
    IDiseaseDetection,
    | '_id'
    | 'cropName'
    | 'description'
    | 'diseaseName'
    | 'symptoms'
    | 'treatment'
    | 'causes'
    | 'preventiveTips'
    | 'embedded'
  > | null> {
    const results = await DiseaseDetectionService.search(name, session);
    if (!results.length) return null;
    return DiseaseDetectionService.findBestMatch(results, embed);
  }

  private async addHistory(
    userId: string,
    crop: string,
    desc: string | undefined,
    img: Express.Multer.File,
    diseaseId: Types.ObjectId,
    session: mongoose.ClientSession
  ): Promise<IDiseaseDetectionHistory> {
    let uploaded;
    try {
      uploaded = await this.uploadImage(img);
      this.uploader.deleteFile(img.path);
      const [h] = await DiseaseDetectionHistory.create(
        [
          {
            userId,
            cropName: crop,
            description: desc,
            detectedDisease: { status: 'success', id: diseaseId },
            image: uploaded,
          },
        ],
        { session }
      );
      return h;
    } catch (err) {
      if (uploaded?.id) await imageKitUtil.deleteImage(uploaded.id);
      this.logger.logError(err as Error, 'Error saving history.');
      throw err;
    }
  }

  private async generateDetails(
    name: string,
    crop: string,
    desc?: string
  ): Promise<OutputDetectDisease> {
    const prompt = DiseaseDetectionPrompt.getNewDiseaseDetectionGeneratingPrompt(name, crop, desc);
    let raw = await this.gemini.generateResponse(prompt);
    if (!raw) throw new Error('AI failed to generate details.');
    // Remove code block wrappers if present
    raw = raw.trim();
    if (raw.startsWith('```')) {
      raw = raw
        .replace(/^```json?\n?/, '')
        .replace(/```$/, '')
        .trim();
    }
    const parsed = JSON.parse(raw);
    if (!parsed.diseaseName || !parsed.symptoms || !parsed.treatment)
      throw new Error('Incomplete disease data.');
    return parsed;
  }

  private async uploadImage(image: Express.Multer.File): Promise<{ url: string; id: string }> {
    const upload = await imageKitUtil.uploadImage(
      image.path,
      image.originalname,
      'disease-detection'
    );
    if (!upload.url || !upload.fileId) throw new Error('Upload failed.');
    return { url: upload.url, id: upload.fileId };
  }

  private static findBestMatch(
    data: Pick<
      IDiseaseDetection,
      | '_id'
      | 'cropName'
      | 'description'
      | 'diseaseName'
      | 'symptoms'
      | 'treatment'
      | 'causes'
      | 'preventiveTips'
      | 'embedded'
    >[],
    query: number[],
    threshold = 0.8 // default threshold
  ): Pick<
    IDiseaseDetection,
    | '_id'
    | 'cropName'
    | 'description'
    | 'diseaseName'
    | 'symptoms'
    | 'treatment'
    | 'causes'
    | 'preventiveTips'
    | 'embedded'
  > | null {
    const best = data.reduce<{
      doc: Pick<
        IDiseaseDetection,
        | '_id'
        | 'cropName'
        | 'description'
        | 'diseaseName'
        | 'symptoms'
        | 'treatment'
        | 'causes'
        | 'preventiveTips'
        | 'embedded'
      > | null;
      score: number;
    }>(
      (best, curr) => {
        const score = GeminiUtils.calculateCosineSimilarity(query, curr.embedded || []);
        return score > best.score ? { doc: curr, score } : best;
      },
      { doc: null, score: -Infinity }
    );

    // Return only if best match meets threshold
    return best.score >= threshold ? best.doc : null;
  }

  static async search(
    query: string,
    session: mongoose.ClientSession
  ): Promise<
    Pick<
      IDiseaseDetection,
      | '_id'
      | 'cropName'
      | 'description'
      | 'diseaseName'
      | 'symptoms'
      | 'treatment'
      | 'causes'
      | 'preventiveTips'
      | 'embedded'
    >[]
  > {
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

    return await DiseaseDetection.aggregate(aggregation).session(session).exec();
  }
  private emitProgress = (
    userId: string,
    status: DiseaseDetectionStatus,
    progress: number,
    message: string
  ): Promise<void> => this.socketHndlr().emitProgressUpdate({ userId, status, progress, message });

  private socketHndlr(): DiseaseDetectionSocketHandler {
    return this.socket.diseaseDetection();
  }

  public async getSingleResult(
    userId: string,
    historyId: string
  ): Promise<IDiseaseDetectionHistory | null> {
    if (!Types.ObjectId.isValid(historyId)) return null;
    return await DiseaseDetectionHistory.findOne({ _id: historyId, userId })
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
