# pdf-worker

A background worker service that generates PDFs from HTML using a BullMQ job queue, Puppeteer, and Redis.

---

## How It Works

1. An external service (or `producer.js`) pushes a job onto the `pdf-jobs` Redis queue with an HTML payload and a `jobId`.
2. The worker picks up the job, validates and sanitizes the HTML, renders it via a headless Chrome browser, and saves the PDF to `./output/<jobId>.pdf`.
3. After success or failure, the worker POSTs the job status back to the configured `STATUS_API_URL` so the upstream UI is never left waiting.

```
Producer / External API
        │
        ▼
  Redis (BullMQ queue: "pdf-jobs")
        │
        ▼
    worker.js
        │
        ├── validateImages()   — blocks unsafe / oversized images
        ├── sanitize()         — strips dangerous HTML/attributes
        ├── getBrowser()       — reuses a single Puppeteer instance
        └── generatePdf()      — renders A4 PDF via headless Chrome
              │
              ▼
        ./output/<jobId>.pdf
              │
              ▼
        POST /internal/job-status  (completed | failed)
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ (ESM) |
| Redis | 6+ |
| Google Chrome | installed locally |

---

## Setup

```bash
npm install
```

Copy `.env` and fill in your values:

```bash
cp .env .env.local
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection string |
| `PDF_INTERNAL_TOKEN` | — | Bearer token sent to the status API |
| `STATUS_API_URL` | `http://127.0.0.1:8060/internal/job-status` | Endpoint that receives job status updates |
| `CHROME_PATH` | `C:/Program Files/Google/Chrome/Application/chrome.exe` | Path to Chrome executable |
| `PDF_WORKER_CONCURRENCY` | `1` | Number of jobs processed in parallel |

---

## Running

### Start the worker

```bash
node worker.js
```

The worker concurrency defaults to `1`. Set `PDF_WORKER_CONCURRENCY` in your `.env` to run multiple jobs in parallel (e.g. `PDF_WORKER_CONCURRENCY=3`).

### Push a test job (development only)

```bash
node producer.js
```

This enqueues a sample HTML job and exits. Use it to verify the worker is running correctly.

---

## Project Structure

```
pdf-worker/
├── worker.js              # BullMQ worker — entry point
├── producer.js            # Dev helper to push a test job
├── output/                # Generated PDFs are saved here
├── queue/
│   ├── connection.js      # IORedis connection (shared)
│   └── pdfQueue.js        # BullMQ Queue definition
└── pdf/
    ├── browser.js         # Puppeteer singleton
    ├── generatePdf.js     # Core PDF generation logic
    ├── sanitize.js        # HTML sanitization (sanitize-html)
    └── validateImages.js  # Image validation rules
```

---

## Module Reference

### `queue/connection.js`
Creates and exports a shared `IORedis` connection from `REDIS_URL`. Throws at startup if the variable is missing.

### `queue/pdfQueue.js`
Defines the `pdf-jobs` BullMQ queue with:
- 2 retry attempts on failure
- Exponential backoff starting at 3 seconds
- Completed jobs auto-removed; failed jobs retained for inspection

### `pdf/browser.js` — `getBrowser()`
Lazily launches a single Puppeteer browser instance and reuses it across jobs. Accepts an optional `CHROME_PATH` env override.

### `pdf/generatePdf.js` — `generatePdf(html, outputPath)`
Main PDF pipeline:
1. Rejects empty, non-string, or oversized (>300 KB) HTML.
2. Calls `validateImages()` to enforce image rules.
3. Detects full HTML documents (`<html>` present) — skips wrapping. Wraps raw fragments in a minimal `<!DOCTYPE html>` shell otherwise.
4. Sanitizes with `sanitize()`.
5. Sets a 1200×1600 viewport, waits for `networkidle0`, then renders an A4 PDF with `printBackground: true` and `preferCSSPageSize: true` (no forced margins).

### `pdf/sanitize.js` — `sanitize(html)`
Minimal regex-based security strip that preserves HTML/CSS byte-for-byte except for three targeted removals:
- `<script>` and `<iframe>` tags (including their content) are removed.
- `src` and `href` attributes pointing to `http:`, `https:`, or `file:` URLs are stripped.
- Everything else — `<style>` blocks, inline styles, class attributes, `@page`, `@media print`, pseudo-selectors, table layout, typography, custom properties — is left completely untouched.

This replaces `sanitize-html`, which rewrites the CSS/DOM and breaks complex selectors, pseudo-elements, and layout properties regardless of allowlist configuration.

### `pdf/validateImages.js` — `validateImages(html)`
Enforces three rules before rendering:
- Max **10 images** per document.
- Only **base64 data URIs** are allowed (`data:image/...`) — no external URLs.
- **SVG** images are blocked entirely.
- Each image must be **≤ 500 KB** (decoded).

---

## Job Payload

Jobs pushed onto the queue must include:

```json
{
  "html": "<h1>Hello</h1>",
  "jobId": "unique-job-id"
}
```

| Field | Type | Description |
|---|---|---|
| `html` | `string` | Raw HTML content to render. Max 300,000 characters. |
| `jobId` | `string` | Used as the output filename and sent to the status API. |

---

## Status Callback

After each job the worker calls `STATUS_API_URL` with:

```json
{
  "job_id": "<jobId>",
  "status": "done" | "failed"
}
```

The request includes the header `x-internal-token: <PDF_INTERNAL_TOKEN>`.

---

## Rendering Behavior

### Full HTML vs. Fragment
If the incoming `html` string contains an `<html` tag it is treated as a complete document and passed through as-is. Raw fragments (e.g. `<h1>Hello</h1>`) are automatically wrapped in a minimal `<!DOCTYPE html>` shell with a UTF-8 `<meta charset>`. No CSS is injected in either case.

### Supported vs. Blocked Assets

| Asset type | Supported |
|---|---|
| Inline `style` attributes | ✅ |
| `<style>` blocks (including `@page`, `@media print`, pseudo-selectors) | ✅ |
| Class-based styling, custom properties, typography | ✅ |
| Base64 images (`data:image/png;base64,...`) | ✅ |
| Base64 fonts (`@font-face` with `data:font/...`) | ✅ |
| Any self-contained HTML/CSS layout | ✅ |
| External CSS (`<link rel="stylesheet" href="...">`) | ❌ blocked |
| External fonts (Google Fonts, CDN) | ❌ blocked |
| External images (`<img src="https://...">`) | ❌ blocked |
| Remote URLs of any kind (`http`, `https`, `file`) | ❌ blocked |
| `<script>` tags | ❌ blocked |
| `<iframe>` tags | ❌ blocked |

The worker supports any self-contained HTML/CSS layout. All styling must be embedded in the payload — inline styles, `<style>` blocks, or base64-encoded assets. The worker operates fully offline; any resource requiring a network fetch will not load.

### CSS Preservation
All inline `style` attributes, `class` attributes, and `<style>` blocks are preserved after sanitization. This includes:
- `@page` rules (custom paper size, margins)
- `@media print` rules
- Table borders and background colors
- Inline base64 fonts (`@font-face` with `src: url(data:font/...)`)

### Viewport
Before rendering, the page viewport is set to **1200 × 1600 px**. This prevents layout reflow that can occur when Puppeteer defaults to a narrow viewport.

### Wait Strategy
The page waits for `networkidle0` (timeout: 30 s) before printing, ensuring all synchronous rendering (CSS paint, layout) is complete. Because external URLs are blocked by design, this resolves quickly.

### Margin Handling
No margins are forced by the worker. Spacing is entirely controlled by the document's own CSS. Use an `@page` rule in your HTML to set margins:
```css
@page { margin: 20mm; }
```
If no `@page` rule is present, Chrome's default margins apply.

### Background Rendering
`printBackground: true` is always enabled — background colors, gradients, and images defined in CSS are included in the output.

### Page Size
`preferCSSPageSize: true` means a `@page { size: ... }` rule in the document overrides the `format: "A4"` fallback. If no `@page size` is declared, A4 is used.

### Example — Styled HTML Document
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 15mm; }
      body { font-family: Arial, sans-serif; font-size: 12pt; }
      h1   { color: #1a1a2e; border-bottom: 2px solid #e94560; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 6px 10px; }
      th { background: #1a1a2e; color: #fff; }
      tr:nth-child(even) td { background: #f4f4f4; }
    </style>
  </head>
  <body>
    <h1>Invoice #1042</h1>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
      <tbody>
        <tr><td>Widget A</td><td>3</td><td>$9.00</td></tr>
        <tr><td>Widget B</td><td>1</td><td>$4.50</td></tr>
      </tbody>
    </table>
  </body>
</html>
```

---

## Security Notes

- HTML is sanitized with a minimal regex strip — no DOM rewriting, no CSS mangling.
- `<script>` and `<iframe>` tags are removed entirely.
- `src`/`href` attributes referencing `http:`, `https:`, or `file:` URLs are stripped.
- External image URLs are blocked at the `validateImages()` layer — only base64 images are accepted.
- SVG images are explicitly rejected to prevent SVG-based injection attacks.
- The internal status endpoint is protected by a shared secret token.
