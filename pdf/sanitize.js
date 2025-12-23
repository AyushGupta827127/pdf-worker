import sanitizeHtml from "sanitize-html";

export function sanitize(html) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      "*": ["style"],
      img: ["src", "width", "height"]
    },
    allowedSchemes: ["data"],
    disallowedTagsMode: "discard"
  });
}
