import { Crop, ICropRecommendations } from '../interfaces/cropRecommendations.interface';
import { CropDetails } from '../models/cropDetails.model';
import { CropRecommendations } from '../models/cropRecommendations.model';
import { CropSuggestionCache } from '../models/cropSuggestionCache.model';
import { CropSuggestionHistory } from '../models/cropSuggestionHistory.model';
import { CropSuggestionInput, CropSuggestionStatus } from '../types/cropSuggestion.types';
import { ICropSuggestionHistory } from '../interfaces/cropSuggestionHistory.interface';
import { WeatherAverages, WeatherService } from '../utils/weather.utils';
import { CropSuggestionPrompts } from '../prompts/cropSuggestion.prompts';
import ngeohash from 'ngeohash';
import mongoose, { Types } from 'mongoose';
import Logger from '../utils/logger';
import GeminiUtils from '../utils/gemini.utils';
import { SocketServer } from '../socket.server';
import { CropSuggestionSocketHandler } from '../socket/cropSuggestion.socket';

export class CropSuggestionService {
  private log: Logger;
  private gemini: GeminiUtils;
  private prompt: CropSuggestionPrompts;
  private socket: SocketServer;

  constructor() {
    this.log = Logger.getInstance('CropSuggestion');
    this.gemini = new GeminiUtils();
    this.prompt = new CropSuggestionPrompts();
    this.socket = SocketServer.getInstance();
  }

  public async generateCropSuggestion(input: CropSuggestionInput, userId: string): Promise<void> {
    const key = this.genKey(input);
    this.emitProgress(userId, 'initiated', 10, 'Starting...');
    try {
      const cached = await this.findCached(key, userId);
      if (cached)
        return this.emitDone(
          userId,
          cached.recs,
          await this.saveHistory({
            ...input,
            cacheKey: key,
            userId: new Types.ObjectId(userId),
            cropRecommendationsId: cached.recs._id,
          })
        );

      const weather = await this.fetchWeather(input, userId);
      const { recs, hist } = await this.createRecommendation(input, userId, key, weather);
      this.emitDone(userId, recs, hist);
      this.generateDetails(recs._id, recs.crops, userId).catch(e => {
        this.log.error(`generateDetails failed: ${(e as Error).message}`);
      });
    } catch (e) {
      this.log.error(`User ${userId}: ${(e as Error).message}`);
      this.socketHandler().emitFailed(userId, 'Generation failed. Try again.');
    }
  }

  public async getOneHistory(id: string): Promise<{
    _id: string;
    soilType: string;
    location: { latitude: number; longitude: number };
    farmSize: number;
    irrigationAvailability: boolean;
    recommendations: ICropRecommendations;
  } | null> {
    const hist = await CropSuggestionHistory.findById(id)
      .select('-__v -createdAt -updatedAt -cacheKey -userId')
      .populate({
        path: 'cropRecommendationsId',
        select: '-__v -createdAt -updatedAt',
      });
    if (!hist || !hist.cropRecommendationsId) return null;
    const recs = hist.cropRecommendationsId as ICropRecommendations;
    return {
      _id: hist._id.toString(),
      soilType: hist.soilType,
      location: hist.location,
      farmSize: hist.farmSize,
      irrigationAvailability: hist.irrigationAvailability,
      recommendations: recs,
    };
  }

  public async getHistories(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<ICropSuggestionHistory[]> {
    return CropSuggestionHistory.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id soilType location farmSize irrigationAvailability createdAt');
  }

  private async findCached(
    key: string,
    userId: string
  ): Promise<{
    recs: Pick<ICropRecommendations, '_id' | 'crops' | 'cultivationTips' | 'weathers'>;
  } | null> {
    this.emitProgress(userId, 'analyzing', 15, 'Checking history...');
    const uid = new Types.ObjectId(userId);
    const hist = await this.lookup(CropSuggestionHistory, {
      cacheKey: key,
      userId: uid,
      createdAt: { $gte: this.daysAgo(7) },
    });
    if (hist) return { recs: hist };
    this.emitProgress(userId, 'analyzing', 20, 'Checking cache...');
    const cache = await this.lookup(CropSuggestionCache, {
      cacheKey: key,
      createdAt: { $gte: this.daysAgo(1) },
    });
    return cache ? { recs: cache } : null;
  }

  private async createRecommendation(
    input: CropSuggestionInput,
    uid: string,
    key: string,
    weather: WeatherAverages
  ): Promise<{
    recs: Pick<ICropRecommendations, '_id' | 'crops' | 'cultivationTips' | 'weathers'>;
    hist: Pick<
      ICropSuggestionHistory,
      '_id' | 'soilType' | 'location' | 'farmSize' | 'irrigationAvailability'
    >;
  }> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const recs = await this.callGemini(input, uid, weather);
      await CropSuggestionCache.create([{ cacheKey: key, cropRecommendationsId: recs._id }], {
        session,
      });
      const hist = await this.saveHistory(
        {
          ...input,
          cacheKey: key,
          userId: new Types.ObjectId(uid),
          cropRecommendationsId: recs._id,
        },
        session
      );
      await session.commitTransaction();
      this.emitProgress(uid, 'completed', 100, 'Generated successfully.');
      return { recs, hist };
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  }

  private async callGemini(
    input: CropSuggestionInput,
    uid: string,
    weather: WeatherAverages
  ): Promise<Pick<ICropRecommendations, '_id' | 'crops' | 'cultivationTips' | 'weathers'>> {
    const prompt = this.prompt.getCropRecommendationPrompt({ ...input, ...weather });
    for (let i = 1; i <= 2; i++) {
      this.emitProgress(uid, 'generatingData', 50 + i * 10, `Generating (Attempt ${i})...`);
      try {
        const res = JSON.parse((await this.gemini.generateResponse(prompt)) || '{}');
        if (!res?.crops?.length) throw new Error('Invalid response');
        const [saved] = await CropRecommendations.create([res]);
        return { ...res, _id: saved._id };
      } catch (e) {
        if (i === 2) throw new Error('Gemini AI failed after retries');
        this.log.warn(`Retry ${i} failed: ${(e as Error).message}`);
      }
    }
    throw new Error('Unreachable');
  }

  private async fetchWeather(input: CropSuggestionInput, uid: string): Promise<WeatherAverages> {
    this.emitProgress(uid, 'analyzing', 30, 'Fetching weather...');
    const data = await new WeatherService(
      input.location.latitude,
      input.location.longitude
    ).getWeatherAverages(16);
    this.emitProgress(uid, 'analyzing', 40, 'Weather fetched.');
    return data;
  }

  private async generateDetails(id: Types.ObjectId, crops: Crop[], uid: string): Promise<void> {
    const updated = await Promise.all(crops.map(crop => this.detailCrop(crop, uid)));
    try {
      await CropRecommendations.findByIdAndUpdate(id, { $set: { crops: updated } });
    } catch (e) {
      this.log.error(`Crop detail update fail for ${id}: ${(e as Error).message}`);
      await CropRecommendations.findByIdAndUpdate(id, {
        $set: { crops: updated.map(c => ({ ...c, cropDetails: { status: 'failed' } })) },
      });
    }
  }

  private async detailCrop(crop: Crop, uid: string): Promise<Crop> {
    try {
      const ex = await CropDetails.findOne({
        $or: [{ scientificName: crop.scientificName }, { name: crop.name }],
      }).select('_id slug scientificName');
      if (ex) {
        this.emitCropDetail(uid, 'success', ex.scientificName, ex.slug);
        return { ...crop, cropDetails: { status: 'success', id: ex._id, slug: ex.slug } };
      }
      const res = JSON.parse(
        (await this.gemini.generateResponse(
          this.prompt.getCropDetailsPrompt(crop.name, crop.scientificName)
        )) || '{}'
      );
      if (!res?.name) throw new Error('Invalid AI detail');
      const saved = await CropDetails.create(res);
      this.emitCropDetail(uid, 'success', saved.scientificName, saved.slug);
      return { ...crop, cropDetails: { status: 'success', id: saved._id, slug: saved.slug } };
    } catch {
      this.emitCropDetail(uid, 'failed', crop.scientificName);
      return { ...crop, cropDetails: { status: 'failed' } };
    }
  }

  private async saveHistory(
    data: Omit<ICropSuggestionHistory, 'createdAt' | 'updatedAt' | '_id'> & {
      userId: string | Types.ObjectId;
    },
    session?: mongoose.ClientSession
  ): Promise<
    Pick<
      ICropSuggestionHistory,
      '_id' | 'soilType' | 'location' | 'farmSize' | 'irrigationAvailability'
    >
  > {
    const [h] = await CropSuggestionHistory.create(
      [
        {
          userId: new Types.ObjectId(data.userId),
          soilType: data.soilType,
          location: data.location,
          farmSize: data.farmSize,
          irrigationAvailability: data.irrigationAvailability,
          cacheKey: data.cacheKey,
          cropRecommendationsId: data.cropRecommendationsId,
        },
      ],
      { session }
    );
    return {
      _id: h._id,
      soilType: h.soilType,
      location: h.location,
      farmSize: h.farmSize,
      irrigationAvailability: h.irrigationAvailability,
    };
  }

  private async lookup(
    model: typeof CropSuggestionHistory | typeof CropSuggestionCache,
    query: Record<string, unknown>
  ): Promise<Pick<ICropRecommendations, '_id' | 'crops' | 'cultivationTips' | 'weathers'> | null> {
    const doc = await model.findOne(query).populate({
      path: 'cropRecommendationsId',
      select: 'crops weathers cultivationTips',
    });
    return doc?.cropRecommendationsId
      ? {
          _id: doc.cropRecommendationsId._id,
          crops: doc.cropRecommendationsId.crops,
          cultivationTips: doc.cropRecommendationsId.cultivationTips,
          weathers: doc.cropRecommendationsId.weathers,
        }
      : null;
  }

  private emitDone(
    userId: string,
    recs: ICropRecommendations,
    hist: Pick<
      ICropSuggestionHistory,
      '_id' | 'soilType' | 'location' | 'farmSize' | 'irrigationAvailability'
    >
  ): void {
    this.socketHandler().emitCompleted(userId, {
      ...hist,
      _id: hist._id.toString(),
      recommendations: { ...recs, _id: recs._id.toString() },
    });
  }

  private emitCropDetail(
    userId: string,
    status: 'success' | 'failed',
    sci: string,
    slug?: string
  ): void {
    this.socketHandler().emitCropDetails(userId, { status, slug, scientificName: sci });
  }

  private emitProgress(
    userId: string,
    status: CropSuggestionStatus,
    progress: number,
    msg: string
  ): void {
    this.socketHandler().emitProgress({ userId, status, progress, message: msg });
  }

  private genKey({
    soilType,
    farmSize,
    irrigationAvailability,
    location,
  }: CropSuggestionInput): string {
    const hash = ngeohash.encode(location.latitude, location.longitude, 5);
    const size =
      farmSize <= 1 ? 'small' : farmSize <= 5 ? 'medium' : farmSize <= 10 ? 'large' : 'xlarge';
    return `${soilType}-${size}-${irrigationAvailability}-${hash}`;
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  private socketHandler(): CropSuggestionSocketHandler {
    return this.socket.cropSuggestion();
  }
}
