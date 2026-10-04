/** True until the person has granted or declined sending health chat to DeepSeek. A missing decision is still required. */
export function deepseekConsentPending(decision: string | null | undefined): boolean {
  return decision == null || decision === ''
}
