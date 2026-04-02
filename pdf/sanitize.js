// Minimal security strip — does not parse or rewrite HTML/CSS.
// Removes only the three concrete threats; everything else is preserved byte-for-byte.

// Matches <script ...>...</script> and <iframe ...>...</iframe> (including self-closing)
const DANGEROUS_TAGS = /<(script|iframe)(\s[^>]*)?>.*?<\/\1>|<(script|iframe)(\s[^>]*)?\/?>/gis;

// Matches href="http..." / src="https..." / src='file:...' etc. on any tag
const EXTERNAL_ATTRS = /\s(src|href)=["'](https?:|file:)[^"']*/gi;

export function sanitize(html) {
  return html
    .replace(DANGEROUS_TAGS, "")
    .replace(EXTERNAL_ATTRS, "");
}
