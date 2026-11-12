// Web TLDs that are not also common file extensions (`.sh`, `.md`, `.rs`, `.zip`… stay files).
const WEB_TLDS = new Set([
  "ai", "app", "be", "biz", "ch", "cloud", "co", "com", "de", "dev", "es",
  "eu", "fr", "gg", "info", "io", "it", "me", "net", "nl", "org", "page",
  "site", "tech", "uk", "us", "xyz",
]);

const HOST_URL = /^((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,}))(?::\d{1,5})?(?:[/?#]\S*)?$/;

/** The URL an inline code span names (`https://…` or a bare domain), if any. */
export function inlineCodeUrl(text: string): string | undefined {
  const value = text.trim();
  if (!value || /\s/.test(value)) return undefined;
  if (/^https?:\/\/[^/\s]+/i.test(value)) return value;
  // Lowercase only: `MonoCode.app` is a bundle, `kipense.app` a site.
  const match = HOST_URL.exec(value);
  if (!match || !WEB_TLDS.has(match[2]!)) return undefined;
  return `https://${value}`;
}
