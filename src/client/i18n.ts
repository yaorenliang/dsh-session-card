/**
 * The card's two line labels.
 *
 * The wording follows the official Chinese strings for the same two facts
 * ("N 个子智能体运行中", "N 个后台任务") so the card never invents terminology the
 * rest of the app does not use. English is the fallback locale.
 */

/** One supported language. */
export type CardLocale = 'zh' | 'en'

const ZH = {
  'agents.one': '{n} 个子智能体运行中',
  'agents.other': '{n} 个子智能体运行中',
  'jobs.one': '{n} 个后台任务',
  'jobs.other': '{n} 个后台任务',
  'settings.title': '会话行卡片',
  'settings.description': '在会话标题下显示你最后问的那句话，以及正在运行的子智能体和后台任务。',
  'settings.enable': '启用卡片',
  'settings.showPrompt': '显示提问行',
  'settings.showChips': '显示运行徽标',
} as const

export type MessageKey = keyof typeof ZH

const EN: Record<MessageKey, string> = {
  'agents.one': '{n} subagent running',
  'agents.other': '{n} subagents running',
  'jobs.one': '{n} background task',
  'jobs.other': '{n} background tasks',
  'settings.title': 'Session row cards',
  'settings.description': 'Show what you last asked, plus running subagents and background tasks, under each session title.',
  'settings.enable': 'Enable cards',
  'settings.showPrompt': 'Show the question line',
  'settings.showChips': 'Show running badges',
}

const DICTS: Record<CardLocale, Record<MessageKey, string>> = { zh: ZH, en: EN }

/** Pick the supported language closest to a locale tag. */
export function resolveLocale(tag: string | undefined): CardLocale {
  return tag !== undefined && tag.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/**
 * Translate one message, substituting `{n}`.
 * @param locale - the resolved language.
 * @param key - the message key.
 * @param params - substitution values.
 * @returns the finished text.
 */
export function translate(
  locale: CardLocale,
  key: MessageKey,
  params?: { readonly n?: number },
): string {
  const text = DICTS[locale][key] ?? EN[key]
  return params?.n === undefined ? text : text.replace('{n}', String(params.n))
}
