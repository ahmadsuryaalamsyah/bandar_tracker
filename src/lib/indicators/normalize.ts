/** Fungsi normalisasi bersama. Output selalu 0-100, 50 = netral. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Peta nilai mentah ke 0-100 lewat fungsi logistik berskala tetap.
 *
 *   score = 100 / (1 + exp(-raw / scale))
 *
 * raw = 0 -> 50 (netral). Skala tetap dipakai agar tekanan yang persisten
 * (mis. downtrend berkepanjangan) tetap terbaca ekstrem, bukan kembali ke 50
 * seperti pada normalisasi z-score terhadap histori sendiri.
 */
export function toScore(raw: number, scale = 1): number {
  if (!Number.isFinite(raw)) return 50;
  const divisor = scale > 0 ? scale : 1;
  const x = raw / divisor;
  if (x >= 40) return 100;
  if (x <= -40) return 0;
  return 100 / (1 + Math.exp(-x));
}

/** Alias `toScore(raw, 1)`. */
export function logistic100(x: number): number {
  return toScore(x, 1);
}

/**
 * Squash nilai berarah ke [-1, +1] dengan tanh berskala.
 * Dipakai komponen signal engine: `squash(x, scale) = tanh(x / scale)`.
 */
export function squash(x: number, scale: number): number {
  if (!Number.isFinite(x)) return 0;
  const divisor = scale > 0 ? scale : 1;
  return Math.tanh(x / divisor);
}
