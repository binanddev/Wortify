export const NAV_BASE = 422;
export const NAV_MIN = NAV_BASE * 0.5;
export const NAV_MAX = NAV_BASE * 1.5;
export function navScale(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(50, Math.min(150, number))
    : 100;
}
export const navWidth = (value) => (NAV_BASE * navScale(value)) / 100;
