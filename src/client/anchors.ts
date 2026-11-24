/**
 * The one place the injected DOM is named.
 *
 * The sidebar's own class names carry a build hash, so this plugin addresses
 * rows by the stable `data-row-key` attribute and marks its own additions with
 * private attributes. Keeping the names in one module means the stylesheet, the
 * painter, and the tests cannot drift apart.
 */

/** Set on a row the card layout owns. */
export const ROW_ATTR = 'data-dsc-card'

/** Set on an injected line, naming the role it plays. */
export const ROLE_ATTR = 'data-dsc-role'

/** Set on a line that currently has nothing to show. */
export const EMPTY_ATTR = 'data-dsc-empty'

/** Set on a chip, naming which preset it reports. */
export const CHIP_ATTR = 'data-dsc-chip'

/** Set on a chip reporting nothing running, so it reads quiet. */
export const IDLE_ATTR = 'data-dsc-idle'

/** Set for the one expansion a row plays when the card first appears. */
export const ENTER_ATTR = 'data-dsc-enter'

/** Every session row the official sidebar renders, archived ones included. */
export const ROW_SELECTOR = '[data-row-key^="session:"]'

/**
 * Read the session id out of a row's `data-row-key`.
 * @param row - a session row element.
 * @returns the session id, or undefined when the attribute is not a session key.
 */
export function sessionIdOf(row: Element): string | undefined {
  const key = row.getAttribute('data-row-key')
  if (key === null || !key.startsWith('session:')) return undefined
  const id = key.slice('session:'.length)
  return id === '' ? undefined : id
}
