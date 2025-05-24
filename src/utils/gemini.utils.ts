import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';

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
    imageFile: { path: string; mimeType: string }
  ): Promise<string | undefined> {
    try {
      const uploadedFile = await this.genAI.files.upload({
        file: imageFile.path,
        config: { mimeType: imageFile.mimeType },
      });

      if (!uploadedFile.uri || !uploadedFile.mimeType) {
        throw new Error('File upload failed: Missing URI or MIME type');
      }

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          prompt,
        ]),
      });

      return response.text;
    } catch (error) {
      throw new Error(
        'Failed to generate response from Gemini AI with image:' + (error as Error).message
      );
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
