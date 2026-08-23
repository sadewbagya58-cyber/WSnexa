'use client';

// Lightweight client action for toggling insight dismiss state
import { dismissInsightServerAction, restoreInsightServerAction } from './report';

export async function dismissInsightAction(ruleKey: string, fingerprint: string, branchId?: string | null) {
  return await dismissInsightServerAction(ruleKey, fingerprint, branchId);
}

export async function restoreInsightAction(ruleKey: string, fingerprint: string, branchId?: string | null) {
  return await restoreInsightServerAction(ruleKey, fingerprint, branchId);
}
