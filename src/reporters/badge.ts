// ---------------------------------------------------------------------------
// BadgeReporter - shields.io-style SVG badge generator
// ---------------------------------------------------------------------------

/**
 * Generate a static SVG badge showing the dep-oracle trust score.
 * The badge follows the shields.io flat-square aesthetic and is
 * completely self-contained (no external fonts or assets).
 */
export class BadgeReporter {
  /**
   * Generate an SVG badge string for the given trust score.
   *
   * @param score - Overall trust score (0-100).
   * @returns A complete SVG string that can be saved as .svg or embedded inline.
   */
  generate(score: number): string {
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    const color = this.scoreColor(clamped);
    const scoreText = String(clamped);
    const label = "dep-oracle";

    // Character widths (approximation for Verdana 11px)
    const labelWidth = this.measureText(label);
    const scoreWidth = this.measureText(scoreText);

    // Padding on each side of each section
    const pad = 10;
    const leftWidth = labelWidth + pad * 2;
    const rightWidth = scoreWidth + pad * 2;
    const totalWidth = leftWidth + rightWidth;

    // Vertical center for 20px height badge
    const textY = 14;

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${clamped}">`,
      `  <title>${label}: ${clamped}</title>`,
      `  <linearGradient id="s" x2="0" y2="100%">`,
      `    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>`,
      `    <stop offset="1" stop-opacity=".1"/>`,
      `  </linearGradient>`,
      `  <clipPath id="r">`,
      `    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>`,
      `  </clipPath>`,
      `  <g clip-path="url(#r)">`,
      `    <rect width="${leftWidth}" height="20" fill="#555"/>`,
      `    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>`,
      `    <rect width="${totalWidth}" height="20" fill="url(#s)"/>`,
      `  </g>`,
      `  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">`,
      `    <text x="${leftWidth / 2}" y="${textY}" fill="#010101" fill-opacity=".3">${this.escapeXml(label)}</text>`,
      `    <text x="${leftWidth / 2}" y="${textY - 1}" fill="#fff">${this.escapeXml(label)}</text>`,
      `    <text x="${leftWidth + rightWidth / 2}" y="${textY}" fill="#010101" fill-opacity=".3">${clamped}</text>`,
      `    <text x="${leftWidth + rightWidth / 2}" y="${textY - 1}" fill="#fff">${clamped}</text>`,
      `  </g>`,
      `</svg>`,
    ].join("\n");
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Map a trust score to a hex color string.
   *   0-49  = red (#e05d44)
   *   50-79 = yellow (#dfb317)
   *   80-100 = green (#4c1)
   */
  private scoreColor(score: number): string {
    if (score >= 80) return "#4c1";
    if (score >= 50) return "#dfb317";
    return "#e05d44";
  }

  /**
   * Approximate text width for Verdana 11px.
   * This is a simplified character-width table similar to what
   * shields.io uses internally.
   */
  private measureText(text: string): number {
    // Average character width for Verdana 11px is ~6.8px.
    // Narrow chars (i, l, 1) are ~4px, wide chars (m, w) are ~9px.
    let width = 0;
    for (const ch of text) {
      if ("iljft!|:;,.".includes(ch)) {
        width += 4;
      } else if ("mwMW".includes(ch)) {
        width += 9;
      } else if ("0123456789".includes(ch)) {
        width += 7;
      } else {
        width += 6.5;
      }
    }
    return Math.ceil(width);
  }

  /** Escape special XML characters in text content. */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
