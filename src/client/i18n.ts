/**
 * The card's own sentences.
 *
 * The badges show only the platform glyph and the value — a sidebar row is
 * around 200px wide and a sentence would not fit — so their strings are the
 * tooltip that explains what the value is, and they keep the wording the
 * official sidebar already uses for the same facts.
 *
 * The preset badge shows the preset's own id (ptc, standard, …) untouched: the
 * id is what DSH calls it everywhere a stable name is needed, and inventing an
 * abbreviation here would go stale the moment a deployment declared a fifth
 * preset. Only its tooltip is translated.
 *
 * English is the fallback locale.
 */

/** One supported language. */
export type CardLocale = 'zh' | 'en'

const ZH = {
  'agents.one': '{n} 个子智能体运行中',
  'agents.other': '{n} 个子智能体运行中',
  'jobs.one': '{n} 个后台任务',
  'jobs.other': '{n} 个后台任务',
  'preset.hint': '智能体预设 {t}',
  'settings.title': '会话行卡片',
  'settings.description': '在会话标题下显示你最后问的那句话，以及这一族正在运行的子智能体和后台任务。最后一项管的是侧边栏的会话顺序，与卡片显示无关。',
  'settings.enable': '启用卡片',
  'settings.showPrompt': '显示提问行',
  'settings.showChips': '显示运行徽标',
  'settings.stickyChips': '徽标常驻',
  'settings.autoPinNew': '新建会话默认置顶',
} as const

export type MessageKey = keyof typeof ZH

const EN: Record<MessageKey, string> = {
  'agents.one': '{n} subagent running',
  'agents.other': '{n} subagents running',
  'jobs.one': '{n} background task',
  'jobs.other': '{n} background tasks',
  'preset.hint': 'Agent preset {t}',
  'settings.title': 'Session row cards',
  'settings.description': 'Show what you last asked, and the subagents and background tasks running under this session, beneath each session title. The last switch changes the sidebar order instead, whether or not the card is on.',
  'settings.enable': 'Enable cards',
  'settings.showPrompt': 'Show the question line',
  'settings.showChips': 'Show running badges',
  'settings.stickyChips': 'Keep badges while idle',
  'settings.autoPinNew': 'Pin new sessions',
}

const DICTS: Record<CardLocale, Record<MessageKey, string>> = { zh: ZH, en: EN }

/** Pick the supported language closest to a locale tag. */
export function resolveLocale(tag: string | undefined): CardLocale {
  return tag !== undefined && tag.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/**
 * Translate one message, substituting `{n}` and `{t}`.
 * @param locale - the resolved language.
 * @param key - the message key.
 * @param params - substitution values.
 * @returns the finished text.
 */
export function translate(
  locale: CardLocale,
  key: MessageKey,
  params?: { readonly n?: number; readonly t?: string },
): string {
  let text = DICTS[locale][key] ?? EN[key]
  if (params?.n !== undefined) text = text.replace('{n}', String(params.n))
  if (params?.t !== undefined) text = text.replace('{t}', params.t)
  return text
}