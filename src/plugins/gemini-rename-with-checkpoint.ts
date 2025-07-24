import { visitAllIdentifiersWithCheckpoint } from "./local-llm-rename/visit-all-identifiers-with-checkpoint.js";
import { verbose } from "../verbose.js";
import { showPercentage } from "../progress.js";
import { CheckpointManager } from "../checkpoint.js";
import {
  GoogleGenerativeAI,
  ModelParams,
  SchemaType
} from "@google/generative-ai";

export function geminiRenameWithCheckpoint({
  apiKey,
  model: modelName,
  contextWindowSize,
  checkpointManager
}: {
  apiKey: string;
  model: string;
  contextWindowSize: number;
  checkpointManager?: CheckpointManager;
}) {
  const client = new GoogleGenerativeAI(apiKey);

  return async (code: string): Promise<string> => {
    return await visitAllIdentifiersWithCheckpoint(
      code,
      async (name, surroundingCode) => {
        verbose.log(`Renaming ${name}`);
        verbose.log("Context: ", surroundingCode);

        try {
          const model = client.getGenerativeModel(
            toRenameParams(name, modelName)
          );

          const result = await model.generateContent(surroundingCode);

          const renamed = JSON.parse(result.response.text()).newName;

          verbose.log(`Renamed to ${renamed}`);

          return renamed;
        } catch (error) {
          // On API error, save checkpoint
          if (checkpointManager) {
            verbose.log("API error occurred, checkpoint will be saved");
          }
          throw error;
        }
      },
      contextWindowSize,
      showPercentage,
      { checkpointManager, saveInterval: 5 } // Save every 5 identifiers
    );
  };
}

function toRenameParams(name: string, model: string): ModelParams {
  return {
    model,
    systemInstruction: `Rename Javascript variables/function \`${name}\` to have descriptive name based on their usage in the code."`,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        nullable: false,
        description: "The new name for the variable/function",
        type: SchemaType.OBJECT,
        properties: {
          newName: {
            type: SchemaType.STRING,
            nullable: false,
            description: `The new name for the variable/function called \`${name}\``
          }
        },
        required: ["newName"]
      }
    }
  };
}