# IDX Stock Analysis — Dashboard Lokal

Dashboard web lokal untuk analisis saham Indonesia (BEI/IDX) berbasis data OHLCV.
Masukkan kode saham (BBCA, BBRI, BMRI, ANTM, MDKA, BRMS, SMDR, TMAS, BULL, …), lalu
aplikasi menampilkan candlestick + volume, tiga indikator analisis, status/signal, dan
chart histori indikator.

> **Formula bersifat approximation transparan**, bukan klon indikator proprietary platform
> lain. Semua rumus dijelaskan di [`docs/FORMULAS.md`](docs/FORMULAS.md).

## Fitur

- Input ticker + pilihan timeframe (Harian/Mingguan/Bulanan) dan rentang (3B–Maks).
- Candlestick chart + histogram volume (TradingView `lightweight-charts`).
- Panel **Liquidity Pressure (LPM-like)**, **Intensity**, **Volume Rotation** — skor 0–100 + interpretasi,
  masing-masing dengan konteks (`Trend: ↑/→/↓`, `Momentum: Cooling`, `Volume: Contracting`).
- Panel ringkasan **Market State** (trend-aware) + Strength + Risk + penjelasan otomatis.
- Panel **Trade Plan** (swing harian): Entry / Stop / Target, **R:R**, **horizon (hari bursa)**,
  dan gate kelayakan (trend, momentum, risiko, R:R, likuiditas). Arah `Long` hanya bila semua
  gate lolos, selain itu `No Trade` + alasan. *Indikatif, bukan rekomendasi investasi.*
- Market state: `Strong Buying`, `Accumulation`, `Bullish Consolidation`, `Neutral`,
  `Distribution`, `Bearish Consolidation`, `Strong Selling`.
- Chart histori indikator (0–100, garis netral 50).
- **Auto-refresh** data (default 30 dtk, berhenti saat tab tidak aktif) + indikator
  keterlambatan: waktu kutipan pasar (WIB), selisih delay, dan waktu tarik terakhir.
- **Dua profil trade**: `Swing` (horizon 2–30 hari) dan `Cepat 1–3 hari` (stop/target rapat,
  wajib di atas SMA20, likuid, volume mengembang). Indikator & signal engine sama untuk
  keduanya — hanya level, gate, dan aturan backtest yang berbeda.
- **Screener + watchlist**: memindai **227 kode IDX likuid** (setiap kode diverifikasi
  ke provider — lihat `src/lib/screener/universe.ts`), menyaring saham yang lolos seluruh
  gate trade plan ("Kandidat Long"), plus watchlist lokal (localStorage). Pemindaian
  berjalan **bertahap per gelombang 25 kode** dengan progress bar — bukan satu tembakan
  besar, karena itu yang memicu HTTP 429. Satu pemindaian penuh ≈ 18–21 detik.
  Saat tidak ada yang lolos, panel menampilkan **sebaran penyebab per gate** dan daftar
  **"hampir lolos"** (gagal tepat satu gate) — jadi daftar kosong tetap informatif.
- **Backtest walk-forward** (in-sample): menguji gate trade plan pada data historis dengan
  aturan no-lookahead — sinyal hanya memakai bar sebelumnya, eksekusi di open bar berikutnya.
  Menghasilkan win rate, **expectancy (R)**, profit factor, max drawdown, dan MAE/MFE per trade.
  Lihat [`docs/FORMULAS.md` §9](docs/FORMULAS.md).
- **Menu bar bertab** (Analisis · Trade Plan · Screener · Watchlist) agar tiap bagian tidak
  menumpuk dalam satu halaman panjang. Tab aktif disimpan di URL hash, jadi tombol back/forward
  berpindah tab dan tautannya bisa dibagikan.
- **Tema terang/gelap** dengan toggle, mengikuti preferensi OS bila belum dipilih.
  Seluruh warna UI memakai design token di `globals.css` (tanpa warna hardcoded di komponen).
- Loading / error / empty state, layout responsif.

## Stack

- **Next.js (App Router) + TypeScript** — UI + API route sebagai proxy server-side (menghindari CORS).
- **lightweight-charts** (TradingView, MIT) — chart candlestick & volume.
- **Tailwind CSS v4** — styling.
- **Vitest** — unit test logika indikator (pure functions).

## Arsitektur

```
src/
├─ app/
│  ├─ page.tsx, layout.tsx       # shell + skrip init tema (anti-FOUC)
│  ├─ globals.css                # design token light/dark (satu sumber warna)
│  └─ api/
│     ├─ ohlcv/route.ts          # GET /api/ohlcv?ticker=&interval=&range=
│     ├─ screener/route.ts       # GET /api/screener?tickers=&interval=&range=
│     └─ backtest/route.ts       # GET /api/backtest?ticker=&interval=&range=
├─ components/                   # UI (TopBar+NavBar, Panel, Dashboard, charts, form, states)
├─ hooks/                        # useOhlcv, useScreener, useBacktest
└─ lib/
   ├─ data/                      # LAPISAN DATA (fetch + parse)
   │  ├─ types.ts, provider.ts   # StockDataProvider interface + registry
   │  └─ providers/yahoo.ts      # YahooFinanceProvider
   ├─ indicators/                # LAPISAN HITUNG (pure, tanpa I/O)
   │  ├─ config.ts, movingAverage.ts, normalize.ts
   │  ├─ lpm.ts, intensity.ts, volumeRotation.ts
   │  ├─ atr.ts, levels.ts, tradePlan.ts
   │  └─ signal/                 # trend-aware signal engine
   │     ├─ trend.ts, momentum.ts, volume.ts, risk.ts
   │     └─ marketState.ts, explanation.ts, index.ts
   ├─ screener/                  # universe (227 kode terverifikasi), select, limits (pure)
   ├─ backtest/                  # engine.ts, types.ts (pure, walk-forward)
   └─ utils/                     # format, label, watchlist, theme, chartTheme, nav
tests/indicators.test.ts
tests/signal.test.ts
tests/tradePlan.test.ts
tests/screener.test.ts
tests/backtest.test.ts
docs/FORMULAS.md
```

Empat lapisan dipisahkan tegas: **data-fetching** (`lib/data`) ⟂ **calculation** (`lib/indicators`,
`lib/screener`, `lib/backtest`) ⟂ **presentasi tema** (`app/globals.css` + `lib/utils/theme.ts`)
⟂ **UI** (`components`). Indikator, signal engine, dan backtest adalah pure function sehingga
mudah diuji dengan fixture deterministik.

## Sumber data & keterbatasan

**Provider default: Yahoo Finance chart API** (`query1.finance.yahoo.com/v8/finance/chart`).
Ticker IDX memakai suffix `.JK` (mis. `BBCA.JK`). Tidak butuh API key.

Keterbatasan yang perlu Anda tahu:

- API **tidak resmi/undocumented**; ToS membatasi redistribusi komersial → dipakai untuk
  **konsumsi pribadi/lokal**. Untuk penggunaan komersial, ganti ke provider berlisensi.
- Kuotasi umumnya **delayed** (~15 menit); bisa **rate-limited** (HTTP 429).
- Data IDX bisa punya gap (hari libur, saham tidak likuid → volume 0).
- Historis **intraday** terbatas (1 jam ~2 tahun, 5 menit ~60 hari) — karena itu hanya
  disediakan timeframe Harian/Mingguan/Bulanan.
- Nilai `null` pada bar tertentu di-skip saat parsing.

Provider dibuat **swappable**: tambahkan implementasi `StockDataProvider` baru di
`src/lib/data/providers/`, daftarkan di `src/lib/data/index.ts`, lalu set `STOCK_PROVIDER`.

## Menjalankan

Butuh Node.js 20+.

```bash
npm install
cp .env.example .env.local     # opsional; tidak ada secret yang wajib
npm run dev
```

Buka http://localhost:3000.

### Script

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan dev server (localhost:3000) |
| `npm run build` | Build produksi |
| `npm start` | Jalankan hasil build |
| `npm test` | Unit test indikator (Vitest) |
| `npm run typecheck` | Cek tipe TypeScript |
| `npm run lint` | ESLint |

## Konfigurasi (`.env.local`)

Semua opsional — **tidak ada API key/token/password** yang dibutuhkan. Lihat `.env.example`.

| Variabel | Default | Keterangan |
|---|---|---|
| `STOCK_PROVIDER` | `yahoo` | Provider aktif |
| `YAHOO_CHART_BASE_URL` | endpoint Yahoo | Override base URL |
| `IDX_MARKET_SUFFIX` | `.JK` | Suffix bursa |
| `STOCK_REQUEST_TIMEOUT_MS` | `15000` | Timeout request provider |

## Formula

Ringkasan (detail + contoh perhitungan di [`docs/FORMULAS.md`](docs/FORMULAS.md)):

- **Liquidity Pressure** = `RVOL × (0.6·CLV + 0.4·tanh(r / sd_r))`, lalu dipetakan 0–100.
- **Intensity** = `0.5·z(V) + 0.3·z(H−L) + 0.2·z(|r|)`, lalu dipetakan 0–100.
- **Volume Rotation** = `0.6·(RVOL − 1) + 0.4·(V_i/V_{i−1} − 1)`, lalu dipetakan 0–100.
- **Signal engine** menurunkan 4 komponen (`trend`, `momentum`, `volume`, `risk`) dari MA
  (SMA20/SMA50, slope), LPM/Intensity/Rotation (level & slope), rasio volume, dan posisi
  harga terhadap recent high/low — lalu memetakannya ke *market state*. Kontraksi volume
  setelah rally, selama trend masih Bullish, dibaca sebagai `Bullish Consolidation`
  (bukan bearish).
- Semua bobot/skala/ambang batas ada di `src/lib/indicators/config.ts` (`signalEngine`).
- `Strength` adalah heuristik kesepakatan komponen, **bukan** probabilitas.
- **Trade Plan**: `ATR(14)` + swing pivot → `entry/stop/target`, `R:R`, `horizon ≈ (target−entry)/(0.6·ATR)`
  hari bursa, plus gate (trend bullish, momentum ≠ Weak, risiko ≠ High, R:R ≥ 2, likuiditas ≥ 2 M).
  Semua ambang di `config.ts → tradePlan`. Ini heuristik; **backtest walk-forward** (§9
  `docs/FORMULAS.md`) tersedia untuk mengukurnya, tetapi ambangnya belum di-tuning dan belum
  memasukkan fee broker, slippage, tick size IDX, maupun dividen.

## Troubleshooting

- **"Rate limit" / gagal memuat**: tunggu sebentar lalu coba lagi; kurangi frekuensi request.
- **Kode saham tidak ditemukan**: pastikan kode benar (mis. `BBCA`, bukan `BCA`).
- **Data kosong**: sebagian saham sangat tidak likuid; coba timeframe/rentang lain.
- **"Kandidat Long" kosong — apakah rusak?** Biasanya **tidak**. Pemindai hanya mencakup
  227 kode likuid, bukan seluruh pasar, dan profil `swing` cuma menghasilkan `Long` bila
  trend benar-benar bullish — jadi di pasar yang sedang turun hasilnya memang sedikit atau
  kosong. Panel menampilkan gate mana yang menyaring berapa saham, plus daftar "hampir lolos".
  Coba ganti ke profil **Cepat 1–3 hari** — gate trend-nya lebih longgar (cukup di atas SMA20).
  Bila **semua** saham gagal dimuat, panel akan mengatakannya (biasanya rate limit Yahoo),
  bukan menampilkan "tidak ada yang lolos".
- **Pemindaian terasa lama / berhenti di tengah**: satu putaran penuh ≈ 18–21 detik karena
  jeda antar gelombang sengaja dipasang agar tidak kena 429. Hasil yang sudah masuk tetap
  ditampilkan, dan bila berhenti di tengah panel memberi tahu sampai berapa yang terpindai.
  Hasil per gelombang di-cache 60 detik di server, jadi menekan "Scan ulang" berikutnya
  jauh lebih cepat.
- **Ingin menambah/mengurangi cakupan?** Sunting `DEFAULT_UNIVERSE` di
  `src/lib/screener/universe.ts`. Karena itu daftar statis, kode yang sudah delisted akan
  terus gagal — jalankan ulang verifikasi terhadap `/api/ohlcv` lalu buang yang gagal.
- **Sebelum memakai sinyal untuk uang nyata**: jalankan panel **Validasi Backtest**. Per
  Okt 2026, pada uji 12 saham likuid selama 2 tahun, **kedua profil masih expectancy negatif**
  (−0.16 R swing, −0.20 R cepat) dan belum memasukkan fee/slippage. Lihat
  [`docs/FORMULAS.md` §9.5](docs/FORMULAS.md).

## Catatan

- Tidak ada credential file yang dibaca/diubah; tidak ada secret di source code.
- Tidak ada commit/push Git otomatis.
- Untuk penggunaan pribadi/lokal. Perhatikan ToS provider data bila ingin dipublikasikan.
