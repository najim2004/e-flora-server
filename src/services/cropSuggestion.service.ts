import { ICrop } from '../interfaces/crop.interface';
import { CropDetails } from '../models/cropDetails.model';
import { CropSuggestionHistory } from '../models/cropSuggestionHistory.model';
import { CropName, CropSuggestionInput } from '../types/cropSuggestion.types';
import { ICropSuggestionHistory } from '../interfaces/cropSuggestionHistory.interface';
import { WeatherAverages, WeatherService } from '../utils/weather.utils';
import { CropSuggestionPrompts } from '../prompts/cropSuggestion.prompts';
// import ngeohash from 'ngeohash';
import { Types } from 'mongoose';
import Logger from '../utils/logger';
import GeminiUtils from '../utils/gemini.utils';
import { SocketServer } from '../socket.server';
import { CropSuggestionSocketHandler } from '../socket/cropSuggestion.socket';
import { ICropDetails } from '../interfaces/cropDetails.interface';
import { Crop } from '../models/crop.model';
import { Image } from '../models/image.model';

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
    this.emitProgress(userId, 'initiated', 10, 'Starting...');
    try {
      const weather = await this.fetchWeather(input.location, userId);
      const cropNames = await this.generateCropNames(input, weather);
      const { found, notFound } = await this.lookup(cropNames);

      if (notFound.length == 0) {
        const hist = await this.saveHistory(input, userId, found, weather);
        this.emitDone(userId, hist);
      }
      const newCrops = await this.generateCrop(cropNames);
      const hist = await this.saveHistory(input, userId, [...found, ...newCrops], weather);
      this.emitDone(userId, hist);
      this.generateDetails(notFound, userId).catch(e => {
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

  private async generateCropNames(
    input: CropSuggestionInput,
    weather: WeatherAverages
  ): Promise<CropName[]> {
    try {
      if (!input.image) return [];
      const prompt = '...';
      const cropNames = await this.gemini.generateResponseWithImage(prompt, {
        path: input.image?.path,
        mimeType: input.image?.mimetype,
      });

      let parsed: unknown = [];
      if (typeof cropNames === 'string') {
        try {
          parsed = JSON.parse(cropNames);
        } catch {
          this.log.error('Failed to parse cropNames JSON');
          parsed = [];
        }
      } else if (Array.isArray(cropNames)) {
        parsed = cropNames;
      }

      if (
        Array.isArray(parsed) &&
        parsed.every(
          item =>
            typeof item === 'object' && item !== null && 'name' in item && 'scientificName' in item
        )
      ) {
        return parsed as CropName[];
      }
      return [];
    } catch (error) {
      this.log.error(`generateCropNames failed: ${(error as Error).message}`);
      return [];
    }
  }

  private async generateCrop(cropNames: CropName[]): Promise<ICrop[]> {
    try {
      const crops: ICrop[] = [];
      cropNames.forEach(async element => {
        const prompt = '...';

        let rawCrop = (await this.gemini.generateResponse(prompt)) || '{}';
        // Remove code block wrappers if present
        rawCrop = rawCrop.trim();
        if (rawCrop.startsWith('```')) {
          rawCrop = rawCrop
            .replace(/^```json?\n?/, '')
            .replace(/```$/, '')
            .trim();
        }

        const res = JSON.parse(rawCrop);
        if (!res?.name || !res?.scientificName) throw new Error('crop generation failed');
        const image = await Image.findOne({
          index: res.scientificName,
        });
        const newCrop = await Crop.create({
          scientificName: res.name,
          imageId: image._id,
          image: res.image,
          difficulty: res.difficulty,
          features: res.features,
          description: res.description,
          maturityTime: res.maturityTime,
          plantingSeason: res.plantingSeason,
          sunlight: res.sunlight,
          waterNeed: res.waterNeed,
          soilType: res.soilType,
          details: {
            status: 'pending',
          },
        });
        crops.push(newCrop);
      });
      return crops;
    } catch (error) {
      this.log.error(`generateCrop failed: ${(error as Error).message}`);
      return [];
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
        // Get raw AI response string
        let raw = (await this.gemini.generateResponse(prompt)) || '{}';

        // Remove wrapping ```json ... ``` code block if present
        raw = raw.trim();
        if (raw.startsWith('```')) {
          raw = raw
            .replace(/^```json?\n?/, '')
            .replace(/```$/, '')
            .trim();
        }

        // Parse the cleaned string as JSON
        const res = JSON.parse(raw);

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

  private async fetchWeather(
    location: CropSuggestionInput['location'],
    uid: string
  ): Promise<WeatherAverages> {
    this.emitProgress(uid, 'analyzing', 30, 'Fetching weather...');
    const data = await new WeatherService(location.latitude, location.longitude).getWeatherAverages(
      16
    );
    this.emitProgress(uid, 'analyzing', 40, 'Weather fetched.');
    return data;
  }

  private async generateDetails(crops: CropName[], uid: string): Promise<void> {
    const updated = await Promise.all(crops.map(crop => this.detailCrop(crop, uid)));
    try {
      for (const crop of updated) {
        if (!crop) {
          continue;
        }

        await Crop.findOneAndUpdate(
          { scientificName: crop.scientificName },
          { $set: { details: updated } }
        );
      }
    } catch (e) {
      this.log.error(`Crop detail update fail: ${(e as Error).message}`);
    }
  }

  private async detailCrop(
    crop: CropName,
    uid: string
  ): Promise<{ scientificName: string; status: string; name: string } | undefined> {
    try {
      const ex = await CropDetails.findOne({
        $or: [{ scientificName: crop.scientificName }, { name: crop.name }],
      }).select('_id slug scientificName');

      if (ex) {
        this.emitCropDetail(uid, 'success', ex.scientificName, ex.slug);
      }

      let raw =
        (await this.gemini.generateResponse(
          this.prompt.getCropDetailsPrompt(crop.name, crop.scientificName)
        )) || '{}';

      // Remove code block wrappers if present
      raw = raw.trim();
      if (raw.startsWith('```')) {
        raw = raw
          .replace(/^```json?\n?/, '')
          .replace(/```$/, '')
          .trim();
      }

      const res = JSON.parse(raw);
      if (!res?.name) throw new Error('Invalid AI detail');

      const saved = await CropDetails.create(res);
      this.emitCropDetail(uid, 'success', saved.scientificName, saved.slug);
    } catch {
      this.emitCropDetail(uid, 'failed', crop.scientificName);
      return { ...crop, status: 'failed' };
    }
  }

  private async saveHistory(
    input: Omit<CropSuggestionInput, 'image' | 'mode'>,
    uid: string,
    crops: ICrop[],
    weather: WeatherAverages
  ): Promise<ICropSuggestionHistory> {
    const [h] = await CropSuggestionHistory.create([
      {
        userId: new Types.ObjectId(uid),
        gardenId: input.gardenId,
        input: {
          location: input.location,
          purpose: input.purpose,
          sunlight: input.sunlight,
          soilType: input.soilType,
          area: input.area,
          waterSource: input.waterSource,
          plantType: input.plantType,
        },
        weather: weather,
        crops: crops.map(crop => ({
          cropId: crop._id,
          cropDetails: { status: 'pending' },
        })),
      },
    ]);
    return h.toObject();
  }

  private async lookup(cropNames: CropName[]): Promise<{
    found: ICrop[];
    notFound: CropName[];
  }> {
    const regexArray = cropNames.map(c => new RegExp(`^${c.scientificName}$`, 'i'));

    const crops = await Crop.find({
      scientificName: { $in: regexArray },
    }).select('-createdAt -updatedAt -__v');

    const foundNames = new Set(crops.map(crop => crop.scientificName.toLowerCase()));

    const notFound = cropNames.filter(c => !foundNames.has(c.scientificName.toLowerCase()));

    return {
      found: crops,
      notFound,
    };
  }

  private emitDone(userId: string, hist: ICropSuggestionHistory): void {
    this.socketHandler().emitCompleted(userId, hist);
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
  private socketHandler(): CropSuggestionSocketHandler {
    return this.socket.cropSuggestion();
  }

  public async getCropDetails(slug: string): Promise<ICropDetails | null> {
    if (!slug) {
      this.log.warn('getCropDetails called with empty slug');
      return null;
    }

    try {
      const details = await CropDetails.findOne({ slug })
        .select('-__v -createdAt -updatedAt')
        .exec();

      if (!details) {
        this.log.debug(`No crop details found for slug: ${slug}`);
        return null;
      }

      return details;
    } catch (error) {
      this.log.error(`Error fetching crop details for ${slug}: ${(error as Error).message}`);
      return null;
    }
  }
}
