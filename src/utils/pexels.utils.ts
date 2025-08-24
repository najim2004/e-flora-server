import axios from 'axios';

export class PexelsUtils {
  public async fetchImageByName(name: string): Promise<{ url: string; index: string } | null> {
    try {
      const endpoint = `https://api.pexels.com/v1/search?query=${name}&per_page=1`;
      const response = await axios.get(endpoint, {
        headers: { Authorization: process.env.PEXELS_API_KEY },
      });

      const data = response.data as {
        photos: { src: { original: string; medium: string; small: string } }[];
      };
      if (data?.photos) {
        const url =
          data?.photos[0]?.src?.medium ||
          data?.photos[0]?.src.small ||
          data.photos[0]?.src.original;
        if (url) {
          return { url, index: name };
        }
      }
      throw new Error('Failed to fetch image');
    } catch (error) {
      console.log('[Pexels Utils line 25]: ', error);
      return null;
    }
  }
}
