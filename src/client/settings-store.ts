/**
 * The card's own preferences.
 *
 * They live in the browser, not the profile: the card is a reading aid, and a
 * person switching it off expects that to hold on this machine without a Host
 * restart. One account-scoped key keeps it to a single localStorage entry.
 */

import type { CardSettings } from './settings.tsx'

/** The browser storage key. */
const STORAGE_KEY = 'dsh-session-card:settings'

/**
 * Everything on, badge line steady: switching the card on keeps its height fixed.
 *
 * The new-session pin is the one default that is off, and off is the whole
 * point: it writes to the Host's durable pin set, which moves rows in the
 * sidebar and outlives the browser. An upgrade must not start reorganising a
 * list nobody asked it to touch, so this stays a switch a person turns on.
 */
const DEFAULTS: CardSettings = {
  enabled: true,
  showPrompt: true,
  showChips: true,
  stickyChips: true,
  autoPinNew: false,
}

/**
 * Read the saved preferences.
 * @param storage - the storage to read, when the browser allows one.
 * @returns the saved settings, or the defaults.
 */
export function loadSettings(storage: Storage | undefined): CardSettings {
  if (storage === undefined) return DEFAULTS
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<CardSettings>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
      showPrompt: typeof parsed.showPrompt === 'boolean' ? parsed.showPrompt : DEFAULTS.showPrompt,
      showChips: typeof parsed.showChips === 'boolean' ? parsed.showChips : DEFAULTS.showChips,
      stickyChips: typeof parsed.stickyChips === 'boolean' ? parsed.stickyChips : DEFAULTS.stickyChips,
      autoPinNew: typeof parsed.autoPinNew === 'boolean' ? parsed.autoPinNew : DEFAULTS.autoPinNew,
    }
  } catch {
    return DEFAULTS
  }
}

/**
 * Save the preferences, ignoring a storage that refuses to write.
 * @param storage - the storage to write.
 * @param settings - the values to keep.
 */
export function saveSettings(storage: Storage | undefined, settings: CardSettings): void {
  if (storage === undefined) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* Private browsing or a full quota: the card still works this session. */
  }
}

/** Reach the account-scoped storage without throwing in a sandboxed frame. */
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export { DEFAULTS as DEFAULT_SETTINGS }