/**
 * The General settings row: four switches that describe the card.
 *
 * The General section supplies no props at all by design — a row draws its own
 * label and writes through its own injected face — so nothing here depends on
 * that package's internal component conventions.
 *
 * @module @deepseek-ai/dsh-session-card/client/settings
 */

import { useState } from 'react'

/** What the row reads and writes. */
export interface CardSettings {
  /** Whether rows are drawn as cards at all. */
  enabled: boolean
  /** Whether the question line is shown. */
  showPrompt: boolean
  /** Whether the running badges are shown. */
  showChips: boolean
  /** Whether the badge line stays once the card is up, even with nothing running. */
  stickyChips: boolean
}

/** The row's injected face. */
export interface SettingsRowInjected {
  /** Values at mount time. */
  readonly initial: CardSettings
  /** Persist one changed value. */
  readonly update: (patch: Partial<CardSettings>) => void
  /** Localized text for the labels. */
  readonly t: (key: SettingsTextKey) => string
}

/** The labels this row renders. */
export type SettingsTextKey =
  | 'settings.title'
  | 'settings.description'
  | 'settings.enable'
  | 'settings.showPrompt'
  | 'settings.showChips'
  | 'settings.stickyChips'

/**
 * Render the card settings row.
 * @param props - the injected face.
 * @returns the row element tree.
 */
export function CardSettingsRow({ initial, update, t }: SettingsRowInjected) {
  const [settings, setSettings] = useState<CardSettings>(initial)
  const toggle = (key: keyof CardSettings): void => {
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    update({ [key]: next[key] })
  }
  const rows: readonly { key: keyof CardSettings; label: string; off: boolean }[] = [
    { key: 'enabled', label: t('settings.enable'), off: false },
    { key: 'showPrompt', label: t('settings.showPrompt'), off: !settings.enabled },
    { key: 'showChips', label: t('settings.showChips'), off: !settings.enabled },
    { key: 'stickyChips', label: t('settings.stickyChips'), off: !settings.enabled || !settings.showChips },
  ]
  return (
    <div className="dsc-settings-group">
      <div className="dsc-settings-title">{t('settings.title')}</div>
      <div className="dsc-settings-description">{t('settings.description')}</div>
      <div className="dsc-settings-toggles">
        {rows.map(row => (
          <label
            key={row.key}
            className={row.off ? 'dsc-settings-toggle dsc-settings-off' : 'dsc-settings-toggle'}
          >
            <span>{row.label}</span>
            <input
              type="checkbox"
              checked={settings[row.key]}
              disabled={row.off}
              onChange={() => { toggle(row.key) }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
