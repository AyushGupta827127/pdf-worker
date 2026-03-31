import sanitizeHtml from "sanitize-html";

export function sanitize(html) {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "html", "head", "body", "meta", "style", "title",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
    ],
    allowedAttributes: {
      "*": ["class", "style", "id", "align", "valign", "width", "height", "colspan", "rowspan", "bgcolor", "border", "cellpadding", "cellspacing"],
      "meta": ["charset", "name", "content", "http-equiv"],
      "img": ["src", "alt", "width", "height", "style", "class"],
      "a": ["href", "name", "target"],
    },
    allowedStyles: {
      "*": {
        // allow all inline CSS properties
        "*": [/.*/],
      },
    },
    // preserve <style> tag content including @page and @media rules
    allowVulnerableTags: false
  })
}
