export interface StorageProvider {
  upload(bucket: string, path: string, file: Buffer, contentType?: string): Promise<string>;
  remove(bucket: string, path: string): Promise<void>;
  getUrl(bucket: string, path: string): string;
}

let _provider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!_provider) {
    // In dev, use local storage
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LocalStorage } = require("./local");
    _provider = new LocalStorage() as StorageProvider;
  }
  return _provider;
}
