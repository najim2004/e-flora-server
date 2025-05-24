import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';

class GeminiUtils {
  private genAI: GoogleGenAI;
  private static apiKey: string = process.env.GOOGLE_API_KEY || '';

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: GeminiUtils.apiKey });
  }

  async generateResponse(prompt: string): Promise<string | undefined> {
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

  async generateResponseWithImage(
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

  async generateEmbedding(text: string): Promise<number[]> {
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
}

export default GeminiUtils;
