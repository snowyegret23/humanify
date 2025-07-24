import fs from "fs/promises";
import path from "path";
import { verbose } from "./verbose.js";

interface CheckpointData {
  processedIdentifiers: Set<string>;
  renames: Map<string, string>;
  currentFileIndex: number;
  currentIdentifierIndex: number;
  timestamp: number;
  // Remove code field - we don't need to store the entire code
}

export class CheckpointManager {
  private checkpointDir: string;
  private checkpointFile: string;
  
  constructor(outputDir: string) {
    this.checkpointDir = path.join(outputDir, ".checkpoints");
    this.checkpointFile = path.join(this.checkpointDir, "checkpoint.json");
  }
  
  async ensureCheckpointDir(): Promise<void> {
    try {
      await fs.mkdir(this.checkpointDir, { recursive: true });
      console.log(`Checkpoint directory created/verified at: ${this.checkpointDir}`);
    } catch (error) {
      console.error("Error creating checkpoint directory:", error);
    }
  }
  
  async saveCheckpoint(data: CheckpointData): Promise<void> {
    await this.ensureCheckpointDir();
    
    const serializedData = {
      processedIdentifiers: Array.from(data.processedIdentifiers),
      renames: Array.from(data.renames.entries()),
      currentFileIndex: data.currentFileIndex,
      currentIdentifierIndex: data.currentIdentifierIndex,
      timestamp: data.timestamp
    };
    
    try {
      console.log(`Saving checkpoint to: ${this.checkpointFile}`);
      await fs.writeFile(
        this.checkpointFile, 
        JSON.stringify(serializedData, null, 2)
      );
      console.log(`Checkpoint saved successfully with ${data.processedIdentifiers.size} identifiers`);
      verbose.log(`Checkpoint saved at ${new Date(data.timestamp).toISOString()}`);
    } catch (error) {
      console.error("Failed to save checkpoint:", error);
      console.error("Checkpoint file path:", this.checkpointFile);
    }
  }
  
  async loadCheckpoint(): Promise<CheckpointData | null> {
    try {
      const data = await fs.readFile(this.checkpointFile, "utf-8");
      const parsed = JSON.parse(data);
      
      return {
        processedIdentifiers: new Set(parsed.processedIdentifiers),
        renames: new Map(parsed.renames),
        currentFileIndex: parsed.currentFileIndex,
        currentIdentifierIndex: parsed.currentIdentifierIndex,
        timestamp: parsed.timestamp
      };
    } catch (error: any) {
      // Only log if it's not a file not found error
      if (error.code !== 'ENOENT') {
        verbose.log("Error loading checkpoint:", error);
      }
      return null;
    }
  }
  
  async hasCheckpoint(): Promise<boolean> {
    try {
      await fs.access(this.checkpointFile);
      return true;
    } catch {
      return false;
    }
  }
  
  async clearCheckpoint(): Promise<void> {
    try {
      await fs.unlink(this.checkpointFile);
      verbose.log("Checkpoint cleared");
    } catch (error) {
      verbose.log("Error clearing checkpoint:", error);
    }
  }
  
  async savePartialResults(filename: string, data: PartialResultsData): Promise<void> {
    await this.ensureCheckpointDir();
    
    const resultsFile = path.join(
      this.checkpointDir, 
      `partial_${path.basename(filename)}_${Date.now()}.json`
    );
    
    try {
      await fs.writeFile(resultsFile, JSON.stringify(data, null, 2));
      verbose.log(`Partial results saved to ${resultsFile}`);
    } catch (error) {
      console.error("Failed to save partial results:", error);
    }
  }
  
  async loadPartialResults(): Promise<PartialResult[]> {
    try {
      const files = await fs.readdir(this.checkpointDir);
      const partialFiles = files.filter(f => f.startsWith("partial_"));
      
      const results: PartialResult[] = [];
      for (const file of partialFiles) {
        const data = await fs.readFile(
          path.join(this.checkpointDir, file), 
          "utf-8"
        );
        results.push(JSON.parse(data) as PartialResult);
      }
      
      return results;
    } catch (error: any) {
      // Only log if it's not a directory not found error
      if (error.code !== 'ENOENT') {
        verbose.log("Error loading partial results:", error);
      }
      return [];
    }
  }
  
  async mergePartialResults(): Promise<Map<string, string>> {
    const partialResults = await this.loadPartialResults();
    const mergedRenames = new Map<string, string>();
    
    for (const result of partialResults) {
      if (result.renames) {
        for (const [key, value] of result.renames) {
          mergedRenames.set(key, value);
        }
      }
    }
    
    return mergedRenames;
  }
}