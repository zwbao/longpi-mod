// Plain Chinese for what a study card shows. The signed manifest and the signed consent text are not edited
// (that would break their signature); the card shows these sentences, and the signed text stays whole under
// 「完整同意书」. Each rewritten question keeps its options in the signed order, so the answer index still counts.

export interface PlainQuestion { question_zh: string; options_zh: string[] }

export const PLAIN_SUMMARY: Record<string, string> = {
  'rcv-calibration': '用你历次体检里的常见指标，在这台电脑上算出你自己平常的起伏有多大，再和研究里常用的范围对照。送出去的只有看不出是谁的合计。',
  'walk-timing-glucose': '比较晚饭后走和早晨走之后的血糖。研究正式开始前，数据只保存在你的设备上。',
}

export const PLAIN_QUESTIONS: Record<string, PlainQuestion> = {
  live: {
    question_zh: '现在会把你的检查数据发出这台电脑吗？',
    options_zh: ['会，马上就发', '不会。研究正式开始前，只保存在你的设备上', '你一点同意就会发出去'],
  },
  who: {
    question_zh: '以下哪类人暂不参加这项步行小试验？',
    options_zh: ['谁都可以，包括正在打胰岛素的人', '正在打胰岛素，或在吃容易让血糖过低的药的人，暂不参加', '只有不满 18 岁的人可以'],
  },
  claim: {
    question_zh: '结果会怎么说？',
    options_zh: ['说走路治好了血糖', '只说明两种走法之后的血糖差值，以及该差别是否可靠', '建议你把药停了'],
  },
  leave: {
    question_zh: '离开这台电脑的是什么？',
    options_zh: ['你的原始化验单', '只有看不出是谁的合计数字，不是原始化验单', '你的基因数据'],
  },
  quit: {
    question_zh: '如何退出？',
    options_zh: ['无法退出', '随时可以退出。尚未发出的部分将被删除，已发出的合计无法收回', '要等研究结束才能退'],
  },
  dx: {
    question_zh: '这个结果能当作诊断吗？',
    options_zh: ['能，它可以下诊断', '不能。它只说明起伏的大小，诊疗仍需咨询医生', '可以代替看医生'],
  },
}

export function plainQuestion<T extends { id: string; question_zh: string; options_zh: string[] }>(question: T): T {
  const plain = PLAIN_QUESTIONS[question.id]
  if (!plain || plain.options_zh.length !== question.options_zh.length) return question
  return { ...question, question_zh: plain.question_zh, options_zh: [...plain.options_zh] }
}

export function plainSummary(id: string, signed: string): string {
  return PLAIN_SUMMARY[id] ?? signed
}
