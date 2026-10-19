/**
 * Helper statistik rolling. Saat histori belum cukup (index < window-1),
 * perhitungan "mengembang" memakai seluruh data yang tersedia sehingga bar
 * awal tetap punya nilai. Ini didokumentasikan di docs/FORMULAS.md.
 */

export function smaAt(values: number[], index: number, window: number): number {
  const start = Math.max(0, index - window + 1);
  let sum = 0;
  let count = 0;
  for (let i = start; i <= index; i += 1) {
    const value = values[i];
    if (Number.isFinite(value)) {
      sum += value;
      count += 1;
    }
  }
  return count > 0 ? sum / count : Number.NaN;
}

/**
 * Simpangan baku sampel (n-1) via Welford's online algorithm — satu pass,
 * numerically lebih stabil dari two-pass (sum-of-squares).
 * Mengembalikan 0 bila data < 2.
 */
export function stddevAt(values: number[], index: number, window: number): number {
  const start = Math.max(0, index - window + 1);
  let count = 0;
  let mean = 0;
  let m2 = 0;

  for (let i = start; i <= index; i += 1) {
    const value = values[i];
    if (!Number.isFinite(value)) continue;
    count += 1;
    const delta = value - mean;
    mean += delta / count;
    m2 += delta * (value - mean);
  }

  return count < 2 ? 0 : Math.sqrt(m2 / (count - 1));
}

export function zScoreAt(values: number[], index: number, window: number): number {
  const mean = smaAt(values, index, window);
  const sd = stddevAt(values, index, window);
  if (!Number.isFinite(mean) || sd <= 1e-12) return 0;
  return (values[index] - mean) / sd;
}

export function ema(values: number[], window: number): number[] {
  const out: number[] = [];
  if (values.length === 0) return out;
  const k = 2 / (window + 1);
  let prev = Number.isFinite(values[0]) ? values[0] : 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = Number.isFinite(values[i]) ? values[i] : prev;
    prev = i === 0 ? value : value * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}
