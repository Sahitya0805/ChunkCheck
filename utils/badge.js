// Builds a small shields-style SVG badge: "ChunkCheck | 83/100".
const CHAR_WIDTH = 6.5;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badgeColor(score) {
  if (typeof score !== "number") return "#9f9f9f";
  if (score >= 85) return "#4c9a2a";
  if (score >= 65) return "#c49a2c";
  return "#c0503a";
}

function renderBadge(label, message, color) {
  const labelWidth = Math.round(label.length * CHAR_WIDTH + 12);
  const messageWidth = Math.round(message.length * CHAR_WIDTH + 12);
  const width = labelWidth + messageWidth;
  const safeLabel = escapeXml(label);
  const safeMessage = escapeXml(message);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${safeLabel}: ${safeMessage}">
<title>${safeLabel}: ${safeMessage}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
<rect width="${labelWidth}" height="20" fill="#3f5b2d"/>
<rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
<rect width="${width}" height="20" fill="url(#s)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${labelWidth / 2}" y="14">${safeLabel}</text>
<text x="${labelWidth + messageWidth / 2}" y="14">${safeMessage}</text>
</g>
</svg>`;
}

function scoreBadge(score) {
  const message = typeof score === "number" ? `${score}/100` : "unavailable";
  return renderBadge("ChunkCheck", message, badgeColor(score));
}

module.exports = { scoreBadge, badgeColor, renderBadge, escapeXml };
