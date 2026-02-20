import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'ap-southeast-1';
    this.bucketName = this.configService.get<string>('AWS_BUCKET') || 'caratlas';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  /**
   * Upload a file to S3
   * @param file Buffer or file buffer
   * @param mimetype MIME type of the file
   * @param folder Optional folder path (e.g., 'listings', 'agencies')
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    file: Buffer,
    mimetype: string,
    folder: string = 'listings',
  ): Promise<string> {
    const fileExtension = this.getFileExtension(mimetype);
    const fileName = `${folder}/${randomUUID()}${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
      Body: file,
      ContentType: mimetype,
      // ACL removed - bucket policy should handle public access
    });

    await this.s3Client.send(command);

    // Return public URL (assumes bucket policy allows public read)
    // If bucket is not public, you'll need to use getPublicUrl() or configure bucket policy
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileName}`;
  }

  /**
   * Get a presigned URL for a file (works even if bucket is not public)
   * @param fileUrl Full S3 URL or file key
   * @param expiresIn Expiration time in seconds (default: 1 year)
   * @returns Presigned URL that works without public access
   */
  async getPresignedUrl(fileUrl: string, expiresIn: number = 31536000): Promise<string> {
    try {
      // Extract key from URL if full URL provided
      let key = fileUrl;
      if (fileUrl.includes('.amazonaws.com/')) {
        const urlParts = fileUrl.split('.amazonaws.com/');
        if (urlParts.length === 2) {
          key = urlParts[1];
        }
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      // Fallback to public URL if presigned fails
      return fileUrl;
    }
  }

  /**
   * Get public URL (for when bucket has public read access)
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Upload multiple files to S3
   * @param files Array of file buffers with mimetype
   * @param folder Optional folder path
   * @returns Array of public URLs
   */
  async uploadFiles(
    files: Array<{ buffer: Buffer; mimetype: string }>,
    folder: string = 'listings',
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file.buffer, file.mimetype, folder),
    );
    return Promise.all(uploadPromises);
  }

  /**
   * Delete a file from S3
   * @param fileUrl Full S3 URL of the file to delete
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract key from URL: https://bucket.s3.region.amazonaws.com/key
      const urlParts = fileUrl.split('.amazonaws.com/');
      if (urlParts.length !== 2) {
        throw new Error('Invalid S3 URL format');
      }
      const key = urlParts[1];

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      // Don't throw - file deletion failure shouldn't break the flow
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimetype: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return mimeMap[mimetype] || '.jpg';
  }
}
