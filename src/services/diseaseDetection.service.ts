import { ImageKitUtil } from '../utils/imageKit.util';
import { DiseaseDetection } from '../models/diseaseDetection.model';
import { DiseaseDetectionHistory } from '../models/diseaseDetectionHistory.model';
import { Logger } from '../utils/logger';
import { InputDetectDisease, OutputDetectDisease } from '../types/diseaseDetection.type';
import { DiseaseDetectionPrompt } from '../prompts/diseaseDetection.prompt';
import GeminiUtils from '../utils/gemini.utils';
import { FileUploadUtil } from '../utils/multer.util';
import { PipelineStage } from 'mongoose';
import { IDiseaseDetectionHistory } from '../interfaces/diseaseDetectionHistory.interface';

export class DiseaseDetectionService {
  private imageKitUtil: ImageKitUtil;
  private diseaseDetectionModel = DiseaseDetection;
  private diseaseDetectionModelHistory = DiseaseDetectionHistory;
  private logger: Logger;
  private static prompts = DiseaseDetectionPrompt;
  private gemini: GeminiUtils;
  private readonly uploadUtil: FileUploadUtil;

  constructor() {
    this.imageKitUtil = new ImageKitUtil();
    this.logger = Logger.getInstance('DiseaseDetectionService');
    this.gemini = new GeminiUtils();
    this.uploadUtil = new FileUploadUtil(
      'temp-uploads', // Temp upload directory
      5, // Maximum file size (MB)
      ['image/jpeg', 'image/png', 'image/jpg'] // Allowed image MIME types
    );
  }

  public async detectDisease(input: InputDetectDisease): Promise<void> {
    try {
      const existingCheckWithCropName = await this.existingCheckWithCropName(input.cropName);
      if (existingCheckWithCropName) {
        const _newHistory = await this.createNewHistory({
          userId: input.userId,
          cropName: input.cropName,
          description: input.description,
          image: input.image,
          detectedDiseaseId: existingCheckWithCropName._id,
        });
        return;
      }

      const { diseaseName, embedded } = await this.detectDiseaseAndMakeNewEmbedding(
        input.cropName,
        input.image,
        input.description
      );
      if (!embedded || !diseaseName || embedded.length === 0) {
        throw new Error('Failed to detect disease or generate embedding');
      }

      const existingCheckWithEmbeddedData = await this.existingCheckWithEmbeddedData(
        diseaseName,
        embedded
      );
      if (existingCheckWithEmbeddedData) {
        const _newHistory = await this.createNewHistory({
          userId: input.userId,
          cropName: input.cropName,
          description: input.description,
          image: input.image,
          detectedDiseaseId: existingCheckWithEmbeddedData._id,
        });
        return;
      }
    } catch (error) {
      console.log(error);
    }
  }
  private async existingCheckWithCropName(cropName: string): Promise<OutputDetectDisease | null> {
    try {
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
        .exec();
      if (history.detectedDisease && history.detectedDisease.id)
        return {
          ...history.detectedDisease.id.toObject(),
        };

      if (!history || !history.detectedDisease || !history.detectedDisease.id) {
        const detectedDisease = await this.diseaseDetectionModel
          .findOne({
            cropName,
          })
          .select('-__v -createdAt -updatedAt -embedded')
          .exec();
        if (detectedDisease) {
          return {
            ...detectedDisease.toObject(),
          };
        }
      }
      return null;
    } catch (error) {
      this.logger.logError(error as Error, 'Error checking disease detection history');
      throw error;
    }
  }

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
      if (!detectedDiseaseName || detectedDiseaseName === 'ERROR_INVALID_IMAGE') {
        throw new Error('ERROR_INVALID_IMAGE');
      } else if (detectedDiseaseName === 'NO_DISEASE_DETECTED') {
        throw new Error('NO_DISEASE_DETECTED');
      }

      const generatedEmbedding = await this.gemini.generateEmbedding(detectedDiseaseName);
      if (!generatedEmbedding || generatedEmbedding.length === 0) {
        throw new Error('Failed to generate embedding');
      }
      return { diseaseName: detectedDiseaseName, embedded: generatedEmbedding };
    } catch (error) {
      throw error;
    }
  }

  private async existingCheckWithEmbeddedData(
    diseaseName: string,
    embedded: number[]
  ): Promise<OutputDetectDisease | null> {
    try {
      const allDetectedDiseaseWithRelatedThisKeyWord =
        await DiseaseDetectionService.search(diseaseName);
      if (allDetectedDiseaseWithRelatedThisKeyWord.length > 0) {
        const bestMatchedDisease = DiseaseDetectionService.findBestMatch(
          allDetectedDiseaseWithRelatedThisKeyWord,
          embedded
        );
        return bestMatchedDisease;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  private static findBestMatch(
    dataArray: (OutputDetectDisease & { embedded: number[] })[],
    queryEmbedding: number[]
  ): OutputDetectDisease | null {
    if (!dataArray.length) return null;

    let bestMatch: OutputDetectDisease | null = null;
    let bestScore = -Infinity;

    for (const data of dataArray) {
      if (!data.embedded || data.embedded.length !== queryEmbedding.length) continue;
      const { embedded, ...rest } = data;

      const score = GeminiUtils.calculateCosineSimilarity(queryEmbedding, embedded);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = rest;
      }
    }

    return bestMatch;
  }

  static tokenize(text: string): string[] {
    return text.toLowerCase().match(/\w+/g) || [];
  }

  static async search(query: string): Promise<(OutputDetectDisease & { embedded: number[] })[]> {
    const tokens = this.tokenize(query);

    // $or condition এ diseaseName যোগ করা হলো
    const $or: NonNullable<PipelineStage.Match['$match']>['$or'] = tokens.flatMap(token => [
      { diseaseName: { $regex: token, $options: 'i' } },
      { cropName: { $regex: token, $options: 'i' } },
      { description: { $regex: token, $options: 'i' } },
      { symptoms: { $elemMatch: { $regex: token, $options: 'i' } } },
      { causes: { $elemMatch: { $regex: token, $options: 'i' } } },
      { treatment: { $elemMatch: { $regex: token, $options: 'i' } } },
      { preventiveTips: { $elemMatch: { $regex: token, $options: 'i' } } },
    ]);

    // concatFields এ diseaseName যোগ করা হলো
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

      // response থেকে matchScore, __v, createdAt, updatedAt বাদ দিচ্ছি
      {
        $project: {
          matchScore: 0,
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ];

    return DiseaseDetection.aggregate(aggregation);
  }

  private async uploadImage(image: Express.Multer.File): Promise<{ url: string; id: string }> {
    try {
      const uploadResponse = await this.imageKitUtil.uploadImage(
        image.path,
        image.originalname,
        `disease-detection`
      );
      return {
        url: uploadResponse.url,
        id: uploadResponse.fileId,
      };
    } catch (error) {
      this.logger.logError(error as Error, 'Error uploading image');
      throw error;
    }
  }

  private async createNewHistory(
    input: InputDetectDisease & {
      image: Express.Multer.File;
      detectedDiseaseId: string;
    }
  ): Promise<Pick<IDiseaseDetectionHistory, 'userId' | 'cropName' | 'description' | 'image'>> {
    let uploadedImageData;
    try {
      uploadedImageData = await this.uploadImage(input.image);
      if (!uploadedImageData.url || !uploadedImageData.id)
        throw new Error('Failed to upload image');
      const isCreatedNewHistory = (await this.diseaseDetectionModelHistory.create({
        userId: input.userId,
        cropName: input.cropName,
        description: input.description,
        detectedDisease: {
          status: 'success',
          id: input.detectedDiseaseId,
        },
        image: uploadedImageData,
      })) as IDiseaseDetectionHistory;
      if (!isCreatedNewHistory) throw new Error('Failed to create disease history');
      return {
        userId: isCreatedNewHistory.userId,
        cropName: isCreatedNewHistory.cropName,
        description: isCreatedNewHistory.description,
        image: isCreatedNewHistory.image,
      };
    } catch (error) {
      if (uploadedImageData?.id) this.imageKitUtil.deleteImage(uploadedImageData?.id);
      throw error;
    }
  }
}
