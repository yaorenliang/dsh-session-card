/**
 * The settings row stylesheet, as a string the bundle can install.
 *
 * Generated from settings.css — edit that file, not this one.
 */

export const SETTINGS_STYLESHEET = "/* The settings row: a title, one explanatory line, and three switches that\n   follow the same divider rhythm as the platform's own preference rows. */\n\n.dsc-settings-group {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 16px 0;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\n\n.dsc-settings-title {\n  font-size: 14px;\n  font-weight: 400;\n  line-height: 22px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dsc-settings-description {\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dsc-settings-toggles {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  margin-top: 2px;\n}\n\n.dsc-settings-toggle {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 6px 0;\n  font-size: 13px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n}\n\n.dsc-settings-toggle input {\n  flex: none;\n  width: 16px;\n  height: 16px;\n  margin: 0;\n  accent-color: var(--dsw-alias-state-warn-label);\n  cursor: pointer;\n}\n\n.dsc-settings-off {\n  color: var(--dsw-alias-label-caption);\n  cursor: default;\n}\n"
