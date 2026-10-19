export function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPrice(value: number, currency = "IDR"): string {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(1);
}

export function formatSignedPercent(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatSignedNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, fractionDigits)}`;
}

export function formatRatio(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(fractionDigits)}x`;
}

export function formatDate(t: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(t * 1000));
}

/** Waktu kutipan pasar (unix detik) dalam zona WIB, mis. "07 Okt 11.06". */
export function formatWibDateTime(unixSeconds: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
    hour12: false,
  }).format(new Date(unixSeconds * 1000));
}

/** Jam lokal WIB (dari epoch ms), mis. "11.16.32". */
export function formatWibClock(epochMs: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
    hour12: false,
  }).format(new Date(epochMs));
}

/**
 * Format angka rupiah secara ringkas untuk pesan human-readable.
 * Contoh: 2.500.000.000 → "2.5 M", 500.000.000 → "500 M", 1.200.000 → "1.200 jt".
 * Berbeda dari formatCompact yang memakai Intl — ini memakai unit bahasa Indonesia.
 */
export function formatMoney(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)} T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} M`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)} jt`;
  return value.toFixed(0);
}

