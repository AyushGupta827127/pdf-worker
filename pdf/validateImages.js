const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 500 * 1024; // 500 KB

export function validateImages(html) {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const matches = [...html.matchAll(imgRegex)];

  if (matches.length > MAX_IMAGES) {
    throw new Error(`Too many images: ${matches.length} (max ${MAX_IMAGES})`);
  }

  for (const match of matches) {
    const src = match[1];

    // Block everything except base64
    if (!src.startsWith("data:image/")) {
      throw new Error("Only base64 images are allowed in PDF");
    }

    // Block SVG explicitly
    if (src.startsWith("data:image/svg+xml")) {
      throw new Error("SVG images are not allowed");
    }

    // Validate base64 payload size
    const base64Data = src.split(",")[1];
    if (!base64Data) {
      throw new Error("Invalid base64 image data");
    }

    const byteLength = Buffer.byteLength(base64Data, "base64");
    if (byteLength > MAX_IMAGE_BYTES) {
      throw new Error(
        `Image too large: ${(byteLength / 1024).toFixed(1)} KB (max 500 KB)`
      );
    }
  }
}
