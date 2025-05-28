
import { create } from 'zustand';
import { VideoEntry } from '@/lib/types';

interface SharedVideoStore {
  video: VideoEntry | null;
  setVideo: (video: VideoEntry | null) => void;
}

export const useSharedVideo = create<SharedVideoStore>((set) => ({
  video: null,
  setVideo: (video) => set({ video }),
}));
