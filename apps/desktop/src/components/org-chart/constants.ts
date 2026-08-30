// ── Size constants ────────────────────────────────────────────────────────
//
//  WHY THESE SIZES (Front-End Reasoning):
//  1. Available Space: A standard desktop window is ~1400px. Subtracting the
//     260px sidebar leaves ~1140px of canvas space.
//  2. The "Rule of Three": For an optimal organizational view, you want to be
//     able to see a manager and 3 direct reports side-by-side without zooming.
//  3. The Math: 3 nodes * 320px = 960px + 2 gaps (80px) = 1040px.
//     This perfectly occupies the 1140px workspace at 100% true scale.
//  4. Aspect Ratio: 320x160 is a perfect 2:1 ratio. It provides enough width
//     for full names to not truncate, and enough height to comfortably fit
//     the name, role, and pill badges without excessive empty padding.
//
export const NODE_WIDTH = 320
export const NODE_HEIGHT = 160
export const MANAGER_NODE_WIDTH = 340
export const MANAGER_NODE_HEIGHT = 170

//  Grid layout constants for orphan nodes (no manager assigned).
export const ORPHAN_GAP_X = 40      // 40px distinct horizontal separation
export const ORPHAN_GAP_Y = 40      // 40px clear vertical rhythm

// ── Position save debounce ──────────────────────────────────────────────────
export const SAVE_DEBOUNCE_MS = 2000

// ── Helpers ─────────────────────────────────────────────────────────────────
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}
