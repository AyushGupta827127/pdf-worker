import sanitizeHtml from "sanitize-html";

export function sanitize(html) {
  return sanitizeHtml(html, {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "style"
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
  }
});

}
