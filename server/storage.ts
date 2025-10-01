import { type AnalysisResult, type InsertAnalysis } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createAnalysis(analysis: InsertAnalysis): Promise<AnalysisResult>;
  getAnalysis(id: string): Promise<AnalysisResult | undefined>;
  updateAnalysis(id: string, data: Partial<AnalysisResult>): Promise<AnalysisResult>;
}

export class MemStorage implements IStorage {
  private analyses: Map<string, AnalysisResult>;

  constructor() {
    this.analyses = new Map();
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<AnalysisResult> {
    const id = randomUUID();
    const analysis: AnalysisResult = {
      id,
      fileName: insertAnalysis.fileName,
      fileSize: insertAnalysis.fileSize,
      uploadedAt: new Date().toISOString(),
      status: 'processing',
      messages: [],
    };
    this.analyses.set(id, analysis);
    return analysis;
  }

  async getAnalysis(id: string): Promise<AnalysisResult | undefined> {
    return this.analyses.get(id);
  }

  async updateAnalysis(id: string, data: Partial<AnalysisResult>): Promise<AnalysisResult> {
    const existing = this.analyses.get(id);
    if (!existing) {
      throw new Error('Analysis not found');
    }
    const updated = { ...existing, ...data };
    this.analyses.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
