import { showPercentage } from "../../progress.js";
import { defineFilename } from "./define-filename.js";
import { Prompt } from "./llama.js";
import { unminifyVariableName } from "./unminify-variable-name.js";
import { visitAllIdentifiersWithCheckpoint } from "./visit-all-identifiers-with-checkpoint.js";
import { CheckpointManager } from "../../checkpoint.js";
import { verbose } from "../../verbose.js";

const PADDING_CHARS = 200;

export const localRenameWithCheckpoint = (
  prompt: Prompt, 
  contextWindowSize: number,
  checkpointManager?: CheckpointManager
) => {
  return async (code: string): Promise<string> => {
    const filename = await defineFilename(
      prompt,
      code.slice(0, PADDING_CHARS * 2)
    );

    return await visitAllIdentifiersWithCheckpoint(
      code,
      async (name, surroundingCode) => {
        try {
          return await unminifyVariableName(prompt, name, filename, surroundingCode);
        } catch (error) {
          // On error, save checkpoint
          if (checkpointManager) {
            verbose.log("Local LLM error occurred, checkpoint will be saved");
          }
          throw error;
        }
      },
      contextWindowSize,
      showPercentage,
      { checkpointManager, saveInterval: 10 } // Save every 10 identifiers for local mode
    );
  };
};