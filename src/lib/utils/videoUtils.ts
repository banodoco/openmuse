
import { Logger } from "../logger";

const logger = new Logger("VideoUtils");

/**
 * Attempts to play a video with fallback to muted playback
 */
export const attemptVideoPlay = async (video: HTMLVideoElement, muted: boolean = true): Promise<boolean> => {
  try {
    await video.play();
    logger.log("Video playback started successfully");
    return true;
  } catch (e) {
    logger.warn("Autoplay prevented:", e);
    
    if (!muted) {
      try {
        // Fallback to muted playback
        video.muted = true;
        await video.play();
        logger.log("Muted playback started as fallback");
        return true;
      } catch (e2) {
        logger.warn("Muted playback prevented:", e2);
        return false;
      }
    }
    
    return false;
  }
};

/**
 * Handles video errors and returns user-friendly error messages
 */
export const getVideoErrorMessage = (videoError: MediaError | null, videoSrc: string): { 
  message: string; 
  details: string; 
} => {
  let message = "Error loading video";
  let details = "";
  
  if (videoError) {
    const errorMsg = `Error ${videoError.code}: ${videoError.message}`;
    details += `Code: ${videoError.code}\n`;
    details += `Message: ${videoError.message || "Unknown error"}\n`;
    
    if (videoError.code === 4) {
      details += 'This is a format error, which typically means the video format is not supported or the file is corrupted.\n';
    }
    
    if (videoSrc.startsWith('blob:')) {
      message = `Cannot load blob video. The URL may have expired since your last refresh.`;
      details += 'Blob URLs are temporary and expire when the page is refreshed.\n';
    } else if (videoSrc.startsWith('data:')) {
      message = `Cannot load data URL video. The encoding may be incorrect.`;
      details += 'Data URLs might be too large or improperly encoded.\n';
    }
  }
  
  return { message, details };
};
