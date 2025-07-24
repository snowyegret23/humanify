import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import { CheckpointManager } from "./checkpoint.js";

describe("CheckpointManager", () => {
  const testOutputDir = "./test-output";
  let checkpointManager: CheckpointManager;
  
  beforeEach(async () => {
    await fs.mkdir(testOutputDir, { recursive: true });
    checkpointManager = new CheckpointManager(testOutputDir);
  });
  
  afterEach(async () => {
    await fs.rm(testOutputDir, { recursive: true, force: true });
  });
  
  it("should create checkpoint directory", async () => {
    await checkpointManager.ensureCheckpointDir();
    const checkpointDir = path.join(testOutputDir, ".checkpoints");
    const exists = await fs.access(checkpointDir).then(() => true).catch(() => false);
    assert.strictEqual(exists, true);
  });
  
  it("should save and load checkpoint data", async () => {
    const testData = {
      processedIdentifiers: new Set(["a", "b", "c"]),
      renames: new Map([["a", "array"], ["b", "buffer"]]),
      currentFileIndex: 2,
      currentIdentifierIndex: 10,
      timestamp: Date.now()
    };
    
    await checkpointManager.saveCheckpoint(testData);
    const loadedData = await checkpointManager.loadCheckpoint();
    
    assert.notStrictEqual(loadedData, null);
    assert.deepStrictEqual(Array.from(loadedData!.processedIdentifiers), ["a", "b", "c"]);
    assert.deepStrictEqual(Array.from(loadedData!.renames.entries()), [["a", "array"], ["b", "buffer"]]);
    assert.strictEqual(loadedData!.currentFileIndex, 2);
    assert.strictEqual(loadedData!.currentIdentifierIndex, 10);
  });
  
  it("should detect checkpoint existence", async () => {
    assert.strictEqual(await checkpointManager.hasCheckpoint(), false);
    
    await checkpointManager.saveCheckpoint({
      processedIdentifiers: new Set(),
      renames: new Map(),
      currentFileIndex: 0,
      currentIdentifierIndex: 0,
      timestamp: Date.now()
    });
    
    assert.strictEqual(await checkpointManager.hasCheckpoint(), true);
  });
  
  it("should clear checkpoint", async () => {
    await checkpointManager.saveCheckpoint({
      processedIdentifiers: new Set(),
      renames: new Map(),
      currentFileIndex: 0,
      currentIdentifierIndex: 0,
      timestamp: Date.now()
    });
    
    assert.strictEqual(await checkpointManager.hasCheckpoint(), true);
    await checkpointManager.clearCheckpoint();
    assert.strictEqual(await checkpointManager.hasCheckpoint(), false);
  });
  
  it("should save and load partial results", async () => {
    const partialData = {
      renames: [["x", "xPosition"], ["y", "yPosition"]],
      processedCount: 5
    };
    
    await checkpointManager.savePartialResults("test-file.js", partialData);
    const results = await checkpointManager.loadPartialResults();
    
    assert.strictEqual(results.length, 1);
    assert.deepStrictEqual(results[0].renames, [["x", "xPosition"], ["y", "yPosition"]]);
    assert.strictEqual(results[0].processedCount, 5);
  });
  
  it("should merge partial results", async () => {
    await checkpointManager.savePartialResults("file1.js", {
      renames: [["a", "array"], ["b", "buffer"]]
    });
    
    await checkpointManager.savePartialResults("file2.js", {
      renames: [["c", "cache"], ["d", "data"]]
    });
    
    const merged = await checkpointManager.mergePartialResults();
    
    assert.strictEqual(merged.size, 4);
    assert.strictEqual(merged.get("a"), "array");
    assert.strictEqual(merged.get("b"), "buffer");
    assert.strictEqual(merged.get("c"), "cache");
    assert.strictEqual(merged.get("d"), "data");
  });
});