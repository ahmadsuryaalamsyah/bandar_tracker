/**
 * Batas pemindaian. Dipakai bersama oleh route `/api/screener` dan hook klien
 * supaya keduanya tidak bisa melenceng — kalau ukuran gelombang klien melebihi
 * batas route, sebagian saham akan hilang tanpa error.
 */
export const MAX_TICKERS_PER_REQUEST = 25;

/**
 * Jeda antar gelombang pemindaian. Bukan optimasi: menembak ratusan permintaan
 * ke provider tanpa jeda langsung memicu HTTP 429.
 */
export const SCAN_CHUNK_GAP_MS = 200;
