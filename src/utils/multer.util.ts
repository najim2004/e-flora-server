import multer, { FileFilterCallback, Field, Multer, StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Custom error used for invalid file uploads.
 */
export class FileUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileUploadError';
  }
}

/**
 * Utility class for handling file uploads and deletions using Multer.
 * Supports single, array, and multi-field uploads with MIME validation and custom storage.
 */
export class FileUploadUtil {
  private readonly _multerInstance: Multer;
  public readonly uploadDir: string;
  private readonly maxFileSizeMB: number;
  private readonly allowedMimeTypes: string[];

  /**
   * Constructor to initialize file upload settings.
   * @param uploadDir Directory where files will be stored.
   * @param maxFileSizeMB Max file size in MB.
   * @param allowedMimeTypes Array of allowed MIME types.
   */
  constructor(
    uploadDir = 'uploads/',
    maxFileSizeMB = 5,
    allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf']
  ) {
    this.uploadDir = path.resolve(uploadDir);
    this.maxFileSizeMB = maxFileSizeMB;
    this.allowedMimeTypes = allowedMimeTypes;

    this.ensureUploadDirExists();

    this._multerInstance = multer({
      storage: this.getStorageEngine(),
      fileFilter: this.fileFilter,
      limits: {
        fileSize: this.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
      },
    });
  }

  /**
   * Ensures the upload directory exists, creates it recursively if not found.
   */
  private ensureUploadDirExists(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Generates a unique, sanitized filename with timestamp and UUID to prevent collisions.
   * @param originalName Original uploaded file name.
   * @returns A unique and sanitized filename.
   */
  private generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const sanitized = baseName
      .replace(/[^a-zA-Z0-9]/g, '-') // Replace non-alphanumerics
      .replace(/-+/g, '-') // Collapse multiple dashes
      .toLowerCase();
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    return `${sanitized}-${uniqueSuffix}${ext}`;
  }

  /**
   * Returns a configured Multer storage engine.
   */
  private getStorageEngine(): StorageEngine {
    return multer.diskStorage({
      destination: (_, __, cb) => cb(null, this.uploadDir),
      filename: (_, file, cb) => cb(null, this.generateUniqueFilename(file.originalname)),
    });
  }

  /**
   * Validates uploaded file's MIME type against allowed list.
   */
  private fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (this.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new FileUploadError(
          `Unsupported file type: ${file.mimetype}. Allowed: ${this.allowedMimeTypes.join(', ')}`
        )
      );
    }
  };

  /**
   * Upload a single file from a specific field.
   * @param fieldName Name of the form field.
   */
  public uploadSingle(fieldName: string): ReturnType<Multer['single']> {
    return this._multerInstance.single(fieldName);
  }

  /**
   * Upload multiple files from a single field.
   * @param fieldName Name of the form field.
   * @param maxCount Maximum number of files allowed.
   */
  public uploadArray(fieldName: string, maxCount = 5): ReturnType<Multer['array']> {
    return this._multerInstance.array(fieldName, maxCount);
  }

  /**
   * Upload files from multiple fields.
   * @param fields Array of field definitions with field name and max count.
   */
  public uploadFields(fields: Field[]): ReturnType<Multer['fields']> {
    return this._multerInstance.fields(fields);
  }

  /**
   * Accept files from any field.
   */
  public uploadAny(): ReturnType<Multer['any']> {
    return this._multerInstance.any();
  }

  /**
   * Delete a specific file from the upload directory.
   * @param filenameOrPath Either filename (relative) or full absolute path.
   * @returns True if file was deleted, false if file not found.
   */
  public deleteFile(filenameOrPath: string): boolean {
    const filePath = path.isAbsolute(filenameOrPath)
      ? filenameOrPath
      : path.join(this.uploadDir, filenameOrPath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  /**
   * Clears all files from the upload directory. Use cautiously!
   */
  public clearUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) return;

    const files = fs.readdirSync(this.uploadDir);
    for (const file of files) {
      const filePath = path.join(this.uploadDir, file);
      fs.unlinkSync(filePath);
    }
  }
}
