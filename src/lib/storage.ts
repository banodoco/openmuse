
import { VideoFile } from './types';

class VideoStorage {
  private readonly DB_NAME = 'VideoResponseDB';
  private readonly STORE_NAME = 'videos';
  private readonly DB_VERSION = 1;
  private readonly DEBUG = true;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = (event) => {
        this.error('Error opening database:', event);
        reject(new Error('Could not open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.log('Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          this.log('Video storage created');
        }
      };
    });
  }

  async saveVideo(videoFile: VideoFile): Promise<string> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        
        const request = store.put(videoFile);
        
        request.onsuccess = () => {
          this.log(`Video saved to IndexedDB: ${videoFile.id}`);
          resolve(videoFile.id);
        };
        
        request.onerror = (event) => {
          this.error('Error saving video:', event);
          reject(new Error('Failed to save video'));
        };
      });
    } catch (error) {
      this.error('Error in saveVideo:', error);
      throw error;
    }
  }

  async getVideo(id: string): Promise<Blob | null> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        
        const request = store.get(id);
        
        request.onsuccess = () => {
          const videoFile = request.result as VideoFile | undefined;
          if (videoFile) {
            this.log(`Video retrieved from IndexedDB: ${id}`);
            resolve(videoFile.blob);
          } else {
            this.log(`Video not found in IndexedDB: ${id}`);
            resolve(null);
          }
        };
        
        request.onerror = (event) => {
          this.error('Error retrieving video:', event);
          reject(new Error('Failed to retrieve video'));
        };
      });
    } catch (error) {
      this.error('Error in getVideo:', error);
      throw error;
    }
  }

  async deleteVideo(id: string): Promise<boolean> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        
        const request = store.delete(id);
        
        request.onsuccess = () => {
          this.log(`Video deleted from IndexedDB: ${id}`);
          resolve(true);
        };
        
        request.onerror = (event) => {
          this.error('Error deleting video:', event);
          reject(new Error('Failed to delete video'));
        };
      });
    } catch (error) {
      this.error('Error in deleteVideo:', error);
      throw error;
    }
  }

  async clearAllVideos(): Promise<void> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        
        const request = store.clear();
        
        request.onsuccess = () => {
          this.log('All videos cleared from IndexedDB');
          resolve();
        };
        
        request.onerror = (event) => {
          this.error('Error clearing videos:', event);
          reject(new Error('Failed to clear videos'));
        };
      });
    } catch (error) {
      this.error('Error in clearAllVideos:', error);
      throw error;
    }
  }

  private log(...args: any[]): void {
    if (this.DEBUG) console.log('[VideoStorage]', ...args);
  }

  private warn(...args: any[]): void {
    if (this.DEBUG) console.warn('[VideoStorage]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[VideoStorage]', ...args);
  }
}

export const videoStorage = new VideoStorage();
