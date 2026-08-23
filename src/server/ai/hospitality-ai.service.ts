import { AIContextSnapshot, AIInsightQuestion, AIRecommendationResponse } from '@/lib/ai/ai-types';

export interface HospitalityAIProvider {
  readonly providerName: string;
  generateInsightResponse(
    context: AIContextSnapshot,
    question: AIInsightQuestion
  ): Promise<AIRecommendationResponse>;
}

export class NullAIProvider implements HospitalityAIProvider {
  readonly providerName = 'NullAIProvider';

  async generateInsightResponse(
    context: AIContextSnapshot,
    question: AIInsightQuestion
  ): Promise<AIRecommendationResponse> {
    if (context && question) {
      // Guard reference for provider-free contract
    }
    throw new Error('AI_PROVIDER_NOT_CONFIGURED: AI provider is not configured. Provider-free operational insights engine is active.');
  }

}

export class HospitalityAIService {
  private static provider: HospitalityAIProvider = new NullAIProvider();

  /**
   * Safe entry point for future AI recommendation generation.
   * Returns provider unavailable error when no external LLM provider is registered.
   */
  static async queryAI(
    context: AIContextSnapshot,
    question: AIInsightQuestion
  ): Promise<{ success: boolean; data?: AIRecommendationResponse; error?: string }> {
    try {
      const response = await this.provider.generateInsightResponse(context, question);
      return { success: true, data: response };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI provider unavailable';
      return { success: false, error: msg };
    }
  }
}
