import fs from 'fs/promises';
import { GoogleGenAI } from '@google/genai';

interface ImageFile {
  path: string;
  mimeType: string;
}

interface GenerateImageOptions {
  imageFile?: ImageFile;
  imageUrl?: string;
}

class GeminiUtils {
  private genAI: GoogleGenAI;
  private static apiKey: string = process.env.GOOGLE_API_KEY || '';

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: GeminiUtils.apiKey });
  }

  public async generateResponse(prompt: string): Promise<string | undefined> {
    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      throw new Error('Failed to generate response from Gemini AI:' + (error as Error).message);
    }
  }

  public async generateResponseWithImage(
    prompt: string,
    opt: GenerateImageOptions
  ): Promise<string | undefined> {
    try {
      const buffer: Buffer = opt.imageFile
        ? await fs.readFile(opt.imageFile.path)
        : opt.imageUrl
          ? Buffer.from(await (await fetch(opt.imageUrl)).arrayBuffer())
          : ((): never => {
              throw new Error('Provide either imageFile or imageUrl');
            })();

      const mimeType: string = opt.imageFile?.mimeType || 'image/jpeg';

      const res = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ inlineData: { mimeType, data: buffer.toString('base64') } }, { text: prompt }],
      });

      return res.text;
    } catch (e) {
      throw new Error('Gemini AI failed: ' + (e as Error).message);
    }
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.genAI.models.embedContent({
        model: 'gemini-embedding-exp-03-07',
        contents: text,
      });

      if (!response.embeddings || !response.embeddings.length || !response.embeddings[0].values) {
        throw new Error('No embeddings generated');
      }

      return response.embeddings[0].values;
    } catch (error) {
      throw new Error('Failed to generate embedding from Gemini AI: ' + (error as Error).message);
    }
  }
  static calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimension for cosine similarity calculation.');
    }

    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }
}

export default GeminiUtils;

export const gemini = new GeminiUtils();
