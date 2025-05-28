import ImageKit from 'imagekit';
import path from 'path';
import fs from 'fs';


/**
 * Interface representing the result of a successful image upload.
 */
interface UploadResult {
    fileId: string;
    url: string;
    name: string;
    filePath: string;
  }

export class ImageKitUtil {
  private imagekit: ImageKit;

  constructor() {
    this.imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    });
  }

  /**
   * Uploads an image file to ImageKit.
   * @param filePath Local path to the image file
   * @param fileName Optional custom filename
   * @param folder Optional folder path in ImageKit
   * @returns Uploaded image info
   */
  async uploadImage(filePath: string, fileName?: string, folder?: string): Promise<UploadResult> {
    const buffer = fs.readFileSync(filePath);

    const uploadResponse = await this.imagekit.upload({
      file: buffer,
      fileName: fileName || path.basename(filePath),
      folder,
    });

    return uploadResponse;
  }

  /**
   * Updates an image by deleting the old image and uploading the new one.
   * @param oldFileId ImageKit file ID of the old image
   * @param newFilePath Local path to the new image
   * @param newFileName Optional new filename
   * @param folder Optional folder path
   * @returns Updated image info
   */
  async updateImage(
    oldFileId: string,
    newFilePath: string,
    newFileName?: string,
    folder?: string
  ): Promise<UploadResult> {
    await this.deleteImage(oldFileId);
    return this.uploadImage(newFilePath, newFileName, folder);
  }

  /**
   * Deletes an image from ImageKit using its fileId.
   * @param fileId ImageKit file ID
   * @returns Deletion result
   */
  async deleteImage(fileId: string): Promise<{ success: boolean }> {
    await this.imagekit.deleteFile(fileId);
    return { success: true };
  }
}

export const imageKitUtil= new ImageKitUtil()