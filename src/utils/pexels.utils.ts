import axios from 'axios';

export class PexelsUtils {
  public async fetchImageByName(
    name: string,
    index: string
  ): Promise<{ url: string; index: string } | null> {
    try {
      const endpoint = `https://api.pexels.com/v1/search?query=${name}&per_page=1`;
      const response = await axios.get(endpoint, {
        headers: { Authorization: process.env.PIXELS_API_KEY },
      });

      const data = response.data as {
        photos: { original: string; medium: string; small: string }[];
      };
      const url = data?.photos[0]?.original;
      if (url) {
        return { url, index };
      }
      throw new Error('Failed to fetch image');
    } catch (error) {
      console.log('[Pixels Utils line 23]: ', error);
      return null;
    }
  }
}
