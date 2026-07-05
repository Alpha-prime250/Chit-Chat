// Deterministic color per username, so the same person always gets the
// same avatar color across the sidebar, header, and message bubbles.
const AVATAR_HUES = [4, 24, 44, 160, 190, 210, 260, 290, 320, 340];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // 32-bit int
  }
  return Math.abs(hash);
}

export function getAvatarColor(name) {
  const hue = AVATAR_HUES[hashString(String(name || "?")) % AVATAR_HUES.length];
  return `hsl(${hue}, 62%, 45%)`;
}

export function getInitial(name) {
  const trimmed = String(name || "?").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}