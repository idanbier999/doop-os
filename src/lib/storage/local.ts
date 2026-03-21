import * as fs from "node:fs";
import * as path from "node:path";
import type { StorageProvider } from "./index";

/**
 * Local filesystem storage provider.
 * Stores files in `.doop/uploads/{bucket}/{path}` relative to the project root.
 */
export class LocalStorage implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.join(process.cwd(), ".doop", "uploads");
  }

  async upload(
    bucket: string,
    filePath: string,
    file: Buffer,
    _contentType?: string
  ): Promise<string> {
    const fullPath = path.join(this.baseDir, bucket, filePath);
    const dir = path.dirname(fullPath);

    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, file);

    return this.getUrl(bucket, filePath);
  }

  async remove(bucket: string, filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, bucket, filePath);

    try {
      await fs.promises.unlink(fullPath);
    } catch (err: unknown) {
      // Ignore ENOENT — file already gone
      if (err instanceof Error && (err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  getUrl(bucket: string, filePath: string): string {
    return `/api/files/${bucket}/${filePath}`;
  }
}
