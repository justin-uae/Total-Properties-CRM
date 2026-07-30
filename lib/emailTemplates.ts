/** Replaces `{{token}}` placeholders in a template string with the given values. */
export function renderTemplate(template: string, tokens: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (key in tokens ? tokens[key] : match));
}
