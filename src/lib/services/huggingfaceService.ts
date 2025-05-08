import { createRepo, whoAmI, modelInfo, uploadFile, type RepoId as HubRepoId } from "@huggingface/hub";
import { Logger } from "@/lib/logger";

const logger = new Logger('HuggingFaceService');

export interface HuggingFaceRepoInfo {
  repoIdString: string; // e.g., "username/reponame"
  url: string;    // e.g., "https://huggingface.co/username/reponame"
}

class HuggingFaceService {
  private hfToken: string;
  private credentials: { accessToken: string };
  private textEncoder: TextEncoder; // For converting string to Uint8Array

  constructor(hfToken: string) {
    if (!hfToken) {
      throw new Error("Hugging Face token is required to initialize HuggingFaceService.");
    }
    this.hfToken = hfToken;
    this.credentials = { accessToken: this.hfToken };
    this.textEncoder = new TextEncoder();
    logger.log("HuggingFaceService initialized (using direct function imports with credentials object).");
  }

  /**
   * Creates a new repository on Hugging Face or returns info if it already exists.
   * @param repoName The desired name for the repository (e.g., "my-lora-model"). User's namespace will be prepended.
   * @param privateRepo Whether the repository should be private. Defaults to false.
   * @returns Information about the created or existing repository.
   */
  async createOrGetRepo(repoName: string, privateRepo = false): Promise<HuggingFaceRepoInfo> {
    logger.log(`Attempting to create or get repo: ${repoName}`);
    try {
      const currentUser = await whoAmI({ credentials: this.credentials });
      if (!currentUser || !currentUser.name) {
        throw new Error("Could not determine Hugging Face username.");
      }
      
      const fullRepoName = `${currentUser.name}/${repoName}`;
      const repoWebUrl = `https://huggingface.co/${fullRepoName}`;

      try {
        logger.log(`Checking if repo ${fullRepoName} exists by fetching modelInfo...`);
        await modelInfo({ name: fullRepoName, credentials: this.credentials });
        logger.log(`Repo ${fullRepoName} already exists.`);
        return { repoIdString: fullRepoName, url: repoWebUrl };
      } catch (error: any) {
        if (error && (error.httpStatus === 404 || error.httpStatus === 401)) {
          logger.log(`Repo ${fullRepoName} does not exist or not accessible (status: ${error.httpStatus || 'unknown'}). Attempting to create...`);
        } else if (error && error.message && (error.message.includes('404') || error.message.includes('not found'))) {
          logger.log(`Repo ${fullRepoName} does not exist (error message check). Attempting to create...`);
        } else {
          logger.error(`Unexpected error while checking repo ${fullRepoName} existence:`, error.message, error);
          throw error; 
        }
      }

      logger.log(`Creating new repo: ${fullRepoName}, private: ${privateRepo}`);
      const createdRepo = await createRepo({
        repo: fullRepoName,
        private: privateRepo,
        credentials: this.credentials,
      });
      logger.log(`Repo created successfully. URL from response: ${createdRepo.repoUrl}`);
      
      return { repoIdString: fullRepoName, url: createdRepo.repoUrl };

    } catch (error: any) {
      logger.error(`Error in createOrGetRepo for ${repoName}:`, error.message, error);
      throw new Error(`Failed to create or access Hugging Face repository ${repoName}: ${error.message}`);
    }
  }

  /**
   * Uploads a single file (File or Blob-like content) to the specified repository.
   * The 'file' parameter for the underlying library call can be Blob | Buffer | Uint8Array.
   */
  async uploadRawFile(options: { 
    repoIdString: string;
    fileContent: File | Blob; // Keep this for our method's flexibility
    pathInRepo: string;
    commitTitle?: string;
  }): Promise<string> {
    const { repoIdString, fileContent, pathInRepo, commitTitle } = options;
    const fileNameForLog = fileContent instanceof File ? fileContent.name : pathInRepo;
    logger.log(`Uploading file '${fileNameForLog}' to '${repoIdString}/${pathInRepo}'`);
    try {
      const fileToUpload = fileContent instanceof File ? fileContent : new File([fileContent], pathInRepo);
      const commitInfo = await uploadFile({
        repo: repoIdString, 
        file: fileToUpload,
        commitTitle: commitTitle || `Upload ${pathInRepo}`,
        credentials: this.credentials,
      });
      logger.log(`File '${pathInRepo}' uploaded successfully to ${repoIdString}. Commit URL: ${commitInfo.commit.url}`);
      return commitInfo.commit.url;
    } catch (error: any) {
      logger.error(`Error uploading file '${pathInRepo}' to ${repoIdString}:`, error.message, error);
      throw new Error(`Failed to upload file ${pathInRepo}: ${error.message}`);
    }
  }

  /**
   * Uploads text data (e.g., for README.md) to the specified repository.
   */
  async uploadTextAsFile(options: {
    repoIdString: string;
    textData: string;
    pathInRepo: string;
    commitTitle?: string;
  }): Promise<string> {
    const { repoIdString, textData, pathInRepo, commitTitle } = options;
    logger.log(`Uploading text data to '${repoIdString}/${pathInRepo}'`);
    const textFile = new File([textData], pathInRepo, { type: 'text/plain' });
    
    try {
      const commitInfo = await uploadFile({
        repo: repoIdString,
        file: textFile,
        commitTitle: commitTitle || `Create/Update ${pathInRepo}`,
        credentials: this.credentials,
      });
      logger.log(`Text data uploaded as '${pathInRepo}' successfully to ${repoIdString}. Commit URL: ${commitInfo.commit.url}`);
      return commitInfo.commit.url;
    } catch (error: any) {
      logger.error(`Error uploading text data as '${pathInRepo}' to ${repoIdString}:`, error.message, error);
      throw new Error(`Failed to upload text data as ${pathInRepo}: ${error.message}`);
    }
  }

  // TODO: Consider a method for batching operations into a single commit if needed and supported cleanly.
  // For multiple distinct file uploads, separate commits might be acceptable initially.
}

export default HuggingFaceService; 