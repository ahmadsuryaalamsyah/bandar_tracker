# Dokumentasi Formula Indikator

> **Disclaimer penting.** Indikator di aplikasi ini — **Liquidity Pressure (LPM-like)**,
> **Intensity**, dan **Volume Rotation** — adalah **approximation transparan** yang kami
> rancang sendiri dari data OHLCV. Formula ini **bukan** salinan, reproduksi, maupun
> reverse-engineering dari indikator proprietary apa pun (termasuk indikator bernama
> "LPM" pada platform analisis saham komersial). Tujuannya: memberi pembacaan yang
> dapat dijelaskan, dapat diuji, dan dapat diubah, bukan menggantikan produk berlisensi.
> Semua bobot/skala/ambang batas adalah **pilihan desain** yang bisa Anda sesuaikan.

Kode acuan: `src/lib/indicators/`. Konfigurasi default: `src/lib/indicators/config.ts`.

---

## 1. Input & helper

Setiap bar `i` punya `O_i, H_i, L_i, C_i, V_i` (open, high, low, close, volume).

| Simbol | Rumus | Arti |
|---|---|---|
| `R_i` | `H_i − L_i` | Range candle (dijaga > 0) |
| `CLV_i` | `((C_i − L_i) − (H_i − C_i)) / R_i` | Posisi close dalam range, ∈ [−1, +1]. +1 = close di high, −1 = close di low. `R_i = 0 → 0` |
| `r_i` | `C_i / C_{i−1} − 1` | Return close-to-close (`r_0 = 0`) |
| `SMA(V, W)_i` | rata-rata `V` pada `W` bar terakhir | Baseline volume |
| `RVOL_i` | `V_i / SMA(V, W)_i` | Volume relatif (SMA = 0 → 1) |
| `vc_i` | `V_i / V_{i−1} − 1` | Perubahan volume vs bar sebelumnya |
| `mean_W(x)_i`, `sd_W(x)_i` | rata-rata & simpangan baku sampel `x` pada `W` bar terakhir | Baseline |
| `z_W(x)_i` | `(x_i − mean_W(x)_i) / sd_W(x)_i` | Z-score; `sd = 0 → 0` |

Catatan: jika histori < `W` (mis. awal seri), perhitungan **mengembang** memakai seluruh data
yang tersedia. `sd` memakai pembagi `n − 1` dan bernilai 0 bila data < 2.

## 2. Normalisasi 0–100 (fixed-scale logistik)

```
toScore(raw, scale) = 100 / (1 + exp(−raw / scale))
```

`raw = 0 → 50` (netral); `raw > 0 → > 50`; `raw < 0 → < 50`. Karena skala **tetap**
(bukan relatif terhadap histori sendiri), tekanan yang persisten—misalnya downtrend
berkepanjangan—tetap terbaca ekstrem, bukan kembali ke 50.

`scale` default: LPM `1.5`, Intensity `1`, Rotation `0.8` (makin kecil → makin cepat jenuh).

---

## 3. Liquidity Pressure (LPM-like)

Menggabungkan **volume relatif**, **posisi close dalam range**, dan **perubahan harga**:

```
LP_raw_i = RVOL_i × ( wClose · CLV_i + wChange · tanh( r_i / sd_W(r)_i ) )

LPM_i    = toScore( LP_raw_i , scale_lpm )
```

- `wClose = 0.6`, `wChange = 0.4`, `scale_lpm = 1.5`.
- `tanh(r / sd)` = perubahan harga yang dibatasi ke [−1, +1] dalam satuan volatilitas
  return. `sd = 0 → 0`.
- `RVOL` memberi "keyakinan" pada pembacaan; hari volume tipis → `LP_raw` mendekati 0.

**Interpretasi** (0–100): ≥62 tekanan beli kuat · 55–62 kecenderungan beli · 45–55 netral ·
38–45 kecenderungan jual · ≤38 tekanan jual kuat.

## 4. Intensity

Mengukur **besarnya aktivitas** vs baseline historis (volume, range, dan besaran return):

```
Intensity_raw_i = wVol · z_W(V)_i + wRange · z_W(R)_i + wRet · z_W(|r|)_i
Intensity_i     = toScore( Intensity_raw_i , scale_intensity )
```

- `wVol = 0.5`, `wRange = 0.3`, `wRet = 0.2`, `scale_intensity = 1`.
- Berbeda dari LPM/Rotation, komponen di sini **sudah** z-score terhadap window—memang
  tujuannya mengukur aktivitas relatif terhadap "normal" saham itu sendiri.
- `50` = aktivitas normal; `> 50` = lebih ramai dari biasanya.

**Interpretasi**: ≥75 sangat tinggi · 60–75 tinggi · 40–60 normal · 25–40 rendah · < 25 sangat rendah.

## 5. Volume Rotation

Mengukur **perputaran volume** vs rata-rata dan vs periode sebelumnya:

```
VR_raw_i = wAvg · (RVOL_i − 1) + wPrev · vc_i

VR_i     = toScore( VR_raw_i , scale_rotation )
```

- `wAvg = 0.6`, `wPrev = 0.4`, `scale_rotation = 0.8`.
- `< 50` = volume mengering, `> 50` = volume berputar naik.

**Interpretasi**: ≥70 berputar naik kuat · 58–70 meningkat · 42–58 stabil · 30–42 menurun · ≤30 mengering.

## 6. Signal Engine (trend-aware)

Signal **tidak** hanya membaca candle terakhir. Engine menurunkan state dari 4 komponen
(masing-masing **−1..+1**, 0 = netral) + label, lalu memetakannya ke **market state**.
Kode: `src/lib/indicators/signal/`. Komponen `squash(x, s) = tanh(x / s)`.

### 6.1 TREND
Input: `close/SMA20−1`, `close/SMA50−1` (bila ≥50 bar), `SMA20/SMA50−1`, slope SMA20
(SMA20 sekarang vs `slopeLookback` bar lalu), dan posisi close dalam range recent high/low
(`rangeLookback`).
```
trendScore = Σ wi·squash(fi, si)   → dinormalisasi bila SMA50 belum tersedia → clamp [−1,1]
bobot: d20 .34 · d50 .16 · SMA20vs50 .16 · slope .26 · posisi .08
skala: .02 · .03 · .02 · .02 · (posisi dipakai apa adanya, 2·pos−1)
```
Label: `≥ +0.20 → Bullish` · `≤ −0.20 → Bearish` · selain → `Sideways`.

### 6.2 MOMENTUM
```
momentumScore = .30·squash(slopeLPM, 8) + .40·squash(LPM−50, 10)
              + .10·squash(slopeIntensity, 8) + .20·squash(retMom, 0.05)
```
`slopeX = EMA(X, 5) − EMA(X, 20)`; `retMom = close/close[i−5] − 1`.
Label: `≥ +0.15 → Strengthening` · `≤ −0.30 → Weak` · di antaranya: `slopeLPM ≥ 0 → Recovering`, else `Cooling`.

### 6.3 VOLUME
```
volumeScore = .60·squash(SMA(V,5)/SMA(V,20) − 1, 0.10) + .40·squash(slopeRotation, 8)
```
Label: `≥ +0.15 → Expanding` · `≤ −0.15 → Contracting` · selain → `Normal`.
`sellVolumeRatio` = (rata-rata volume candle turun)/(candle naik) pada `rangeLookback`.

### 6.4 RISK (0..1)
```
riskScore = .15·r_vol + .25·r_drawdown + .15·r_below50 + .10·r_sellVol + .15·r_extended + .20·r_divergence
```
`r_vol` guncangan volatilitas vs baseline · `r_drawdown` jarak dari recent high ·
`r_below50` harga di bawah SMA50 · `r_sellVol` volume jual meningkat ·
`r_extended` kejauhan harga di atas SMA50 (risiko mean-reversion) ·
`r_divergence` arah trend vs momentum tidak sejalan.
Label: `Low < 0.20` · `Moderate 0.20–0.50` · `High ≥ 0.50`.

### 6.5 MARKET STATE (aturan berurutan)
| Trend | Kondisi | State |
|---|---|---|
| Bullish | momentum Strengthening **dan** volume Expanding | **Strong Buying** |
| Bullish | momentum ∈ {Strengthening, Recovering} **dan** LPM ≥ 52 | **Accumulation** |
| Bullish | momentum Weak **dan** (volume Expanding atau volume jual naik) | **Distribution** |
| Bullish | selain itu (Cooling/Contracting/Normal) | **Bullish Consolidation** |
| Bearish | momentum Weak **dan** (volume Expanding atau volume jual naik) | **Strong Selling** |
| Bearish | selain itu | **Bearish Consolidation** |
| Sideways | LPM ≥ 55 dan volume bukan Contracting | **Accumulation** |
| Sideways | LPM ≤ 45 **dan** volume ekspansi/jual naik | **Distribution** |
| Sideways | momentum Weak | **Distribution** |
| Sideways | selain itu | **Neutral** |

**Prinsip kunci:** kontraksi volume / melemahnya momentum **setelah rally tidak otomatis
bearish** selama trend masih Bullish → `Bullish Consolidation`. Bobot bearish kuat hanya bila
trend Bearish **dan** momentum Weak **dan** volume ekspansi/volume jual naik.

### 6.6 STRENGTH (heuristik, **bukan** probabilitas)
```
strengthScore = 100·( .50·rata-rata|skor komponen| + .20·|rata-rata skor| + .30·|trendScore| )
```
Label: `Weak < 25` · `Moderate 25–60` · `Strong ≥ 60`. Bila trend `Sideways`, strength
di-cap ke Moderate. UI menampilkan **label** ini, bukan persentase keyakinan.

## 7. Parameter default (signal engine)

| Parameter | Nilai | Fungsi |
|---|---|---|
| `fastWindow` / `slowWindow` / `longWindow` | 5 / 20 / 50 | EMA pendek, SMA20/EMA panjang, SMA50 |
| `slopeLookback` / `rangeLookback` / `returnMomentumWindow` | 5 / 50 / 5 | slope SMA20, recent high/low & rasio volume jual, momentum return |
| ambang trend | ±0.20 | bull/bear/Sideways |
| ambang momentum | +0.15 / −0.30 | Strengthening / Weak |
| ambang volume | ±0.15 | Expanding / Contracting |
| ambang risk | 0.20 / 0.50 | Moderate / High |
| ambang strength | 25 / 60 | Moderate / Strong |
| `sellVolumeElevated` · `accumulationLpm` · sideways LPM | 1.2 · 52 · 55/45 | aturan state |
| bobot trend | .34/.16/.16/.26/.08 | d20/d50/SMA20vs50/slope/posisi |
| bobot momentum | .30/.40/.10/.20 | slopeLPM/levelLPM/slopeIntensity/ret |
| bobot volume · risk · strength | lihat `config.ts` | — |

> Indikator LPM/Intensity/Rotation (§3–§5) tidak berubah; semua bobot/skala/ambang ada di
> `src/lib/indicators/config.ts` (`signalEngine`).

---

## 8. Trade Plan (profil swing & cepat)

Rencana indikatif: level **Entry / Stop / Target** + **R:R** + perkiraan **horizon**.
Kode: `src/lib/indicators/tradePlan.ts`, primitif `atr.ts` & `levels.ts`.

Ada **dua profil** (`TRADE_PROFILES` di `config.ts`). Indikator & signal engine **sama persis**;
yang berbeda hanya cara level digambar, gate kelayakan, dan aturan backtest-nya.

| | `swing` | `fast` (1–3 hari) |
|---|---|---|
| Horizon | 2–30 hari bursa | 1–3 hari bursa |
| ATR | 14 | 7 (lebih responsif) |
| Stop | support − 0.25·ATR, fallback 1.5·ATR | fallback 0.9·ATR |
| Target | resistance, fallback 3·ATR | fallback 1.3·ATR |
| `minRewardRisk` | 2 | 1.2 |
| Lookback level | 50 bar | 20 bar |
| Gate trend | `trend.label = Bullish` (SMA20 **dan** SMA50) | cukup harga **di atas SMA20** |
| Gate volume | — | volume **tidak** `Contracting` |
| Likuiditas minimum | 2 miliar/hari | 5 miliar/hari |
| Backtest holding | 40 bar | 3 bar |

Alasan profil `fast` melonggarkan gate trend: menuntut `close > SMA50` (rata-rata 50 hari)
tidak relevan untuk posisi yang direncanakan hanya 1–3 hari. Sebagai gantinya dipakai
`close > SMA20` + volume yang tidak mengering, agar tetap menolak saham yang sedang turun.

### 8.1 Primitif
- **ATR(14, Wilder)**: `TR_i = max(H_i−L_i, |H_i−C_{i−1}|, |L_i−C_{i−1}|)`;
  seed = rata-rata TR `period` pertama, lalu `ATR_i = (ATR_{i−1}·(n−1) + TR_i) / n`.
- **Swing pivot** (fractal, radius `k=3`): bar `i` = swing high bila `H_i` tertinggi di
  `H[i−k .. i+k]` (low sebaliknya). Hanya titik terkonfirmasi (`i ≤ n−1−k`) agar tidak repaint.
- **Support** = swing low tertinggi di bawah harga (≤ `supportSearchAtr`·ATR);
  **Resistance** = swing high terendah di atas harga (≤ `resistanceSearchAtr`·ATR).

### 8.2 Level
```
entry  = close terakhir
stop   = support − 0.25·ATR        (fallback: close − 1.5·ATR)
target = resistance                (fallback: close + 3·ATR)
R:R    = (target − entry) / (entry − stop)
horizon(days) = (target − entry) / (0.6·ATR)     → dibulatkan, dijepit 2..30 hari bursa
```
Horizon adalah **estimasi**, bukan janji; `0.6` = asumsi efisiensi pergerakan per bar.

### 8.3 Gate (harus lolos semua → arah `Long`)

| Gate | `swing` | `fast` |
|---|---|---|
| Trend | `trend.label = Bullish` | `closeVsSma20 > 0` |
| Momentum tidak lemah | `momentum.label ≠ Weak` | idem |
| Volume mengembang | *(tidak ada)* | `volume.label ≠ Contracting` |
| Risiko tidak tinggi | `risk.label ≠ High` | idem |
| R:R | `≥ 2` | `≥ 1.2` |
| Likuiditas | rata-rata `close × volume` (lookback 50) `≥ 2 miliar` | `≥ 5 miliar` |

Bila ada gate gagal → arah **`No Trade`** + alasan dari gate pertama yang gagal.
`screener` memakai gate pertama ini untuk mengelompokkan penyebab tersaringnya, dan
melaporkan saham yang gagal **tepat satu** gate sebagai "hampir lolos".

Likuiditas sengaja tetap memakai window 50 bar (konteks volume), terpisah dari `levelLookback`
yang mengatur deteksi support/resistance.

### 8.4 Parameter default

| Parameter | `swing` | `fast` |
|---|---|---|
| `atrPeriod` / `pivotRadius` | 14 / 3 | 7 / 2 |
| `stopAtrMultiple` / `stopBufferAtr` | 1.5 / 0.25 | 0.9 / 0.15 |
| `targetAtrMultiple` | 3 | 1.3 |
| `supportSearchAtr` / `resistanceSearchAtr` | 3 / 6 | 2 / 2.5 |
| `minRewardRisk` | 2 | 1.2 |
| `horizonEfficiency` / horizon min–max | 0.6 / 2–30 hari | 0.5 / 1–3 hari |
| `minAvgValue` | 2.000.000.000 | 5.000.000.000 |
| `levelLookback` / `trendGate` | 50 / `bullish` | 20 / `above-sma20` |
| `requireVolumeExpansion` | `false` | `true` |

> Ini **heuristik yang dapat diubah**. Backtest walk-forward (§9) tersedia untuk mengukur
> perilakunya pada data historis, tetapi ambang di bawah **belum di-tuning** terhadap hasil itu.
> **Bukan rekomendasi investasi** dan tanpa jaminan.

---

## 9. Backtest walk-forward

Kode: `src/lib/backtest/` (`engine.ts` + `types.ts`), test: `tests/backtest.test.ts`.
Tujuannya mengganti klaim ("win rate tinggi") dengan **angka yang bisa direproduksi**.

### 9.1 Aturan eksekusi (no-lookahead)

Untuk setiap bar `i ≥ warmupBars`:

1. Indikator dihitung ulang **hanya dari candle `0..i`** — persis seperti yang terlihat
   pada saat itu. Tidak ada data masa depan yang bocor ke sinyal.
2. Bila trade plan berstatus `Long`, itu satu **sinyal**.
3. Posisi dibuka pada **open bar `i + entryDelayBars`**, bukan close bar sinyal, supaya
   harga eksekusi memang belum terjadi saat keputusan diambil.
4. Posisi berjalan maksimum `maxHoldingBars` bar:
   - `L_j ≤ stop` → keluar di **stop**
   - `H_j ≥ target` → keluar di **target**
   - keduanya tersentuh di bar yang sama → dianggap **stop lebih dulu** (konservatif,
     karena urutan intra-bar tidak diketahui dari OHLC saja)
   - tidak ada yang tersentuh sampai batas → keluar di **close** bar terakhir (`timeout`)
5. Satu instrumen hanya menahan **satu posisi**. Sinyal yang muncul saat posisi masih
   terbuka tetap dihitung di `signals` tetapi tidak dieksekusi — jadi `signals > trades`
   menandakan setup yang terlewat karena posisi sebelumnya masih berjalan.
6. Bila open bar sudah berada di bawah stop (gap), trade dibatalkan (`risk ≤ 0`).

### 9.2 Metrik

Dengan `risk = entry − stop`:

```
rMultiple = (exitPrice − entry) / risk        1R = jarak entry ke stop
MAE       = (entry − min L selama posisi) / risk
MFE       = (max H selama posisi − entry) / risk
```

| Metrik | Rumus |
|---|---|
| `winRate` | `wins / trades` (menang = `rMultiple > 0`) |
| `expectancyR` | rata-rata `rMultiple` — **inti kelayakan**, bukan win rate |
| `profitFactor` | `Σ rMultiple positif / |Σ rMultiple negatif|`; `null` bila tak ada loss |
| `maxDrawdownR` | penurunan terbesar dari puncak kurva ekuitas kumulatif (dalam R) |
| `avgMaeR` / `avgMfeR` | rata-rata MAE/MFE — seberapa dalam trade tertekan vs seberapa jauh sempat menguntungkan |

`expectancyR ≤ 0` berarti sistem belum layak dijalankan apa adanya, **berapa pun** win rate-nya.

### 9.3 Parameter default

| Parameter | `swing` | `fast` | Fungsi |
|---|---|---|---|
| `warmupBars` | 60 | 35 | Bar awal yang dilewati agar SMA50/lookback matang |
| `maxHoldingBars` | 40 | 3 | Batas menahan posisi sebelum dianggap timeout |
| `entryDelayBars` | 1 | 1 | Jeda eksekusi (masuk di open bar berikutnya) |
| `stopFirstOnAmbiguous` | `true` | `true` | Asumsi konservatif saat stop & target ambigu |
| `maxTestBars` | 500 | 500 | Batas bar terakhir yang dievaluasi (biaya walk-forward ~O(n²)) |

`maxHoldingBars` harus **lebih besar** dari `tradePlan.maxHorizonDays`; kalau sama, target
berhorizon terpanjang akan selalu timeout sebelum tercapai dan statistiknya bias.

### 9.4 Keterbatasan (baca sebelum menyimpulkan)

- **In-sample**, bukan out-of-sample/walk-forward bergulir. Angka ini mengukur kecocokan
  pada periode yang sama, bukan bukti kinerja masa depan.
- **Belum ada biaya**: fee broker round-trip, slippage, **tick size (fraksi harga)** IDX,
  lot 100 lembar, ARA/ARB, dan penyesuaian dividen semuanya diabaikan. Karena itu R:R
  nyata selalu lebih buruk dari angka di sini.
- Sampel kecil: pada 1 tahun harian hanya ~180 bar yang diuji, sehingga beberapa ticker
  menghasilkan < 5 trade. Statistik dari 2–3 trade **tidak bermakna**.
- Urutan intra-bar tidak diketahui; aturan `stopFirstOnAmbiguous` menghindari optimisme
  palsu, bukan menghilangkan ambiguitas.
- Ambang di `config.ts` **belum di-tuning** terhadap hasil backtest. Men-tuning ambang
  memakai alat ini akan membuatnya overfit bila tidak ada periode uji terpisah.

### 9.5 Hasil pengukuran awal (12 saham likuid, 2 tahun harian)

| Profil | Trade | Win rate | Expectancy | Total R | Max DD | Rata-rata tahan |
|---|---|---|---|---|---|---|
| `swing` | 88 | 28% | −0.16 R | −13.8 R | 5.0 R | 9.1 bar |
| `fast` | 236 | 35% | −0.20 R | −46.5 R | 9.5 R | 2.2 bar |

**Keduanya belum layak dipakai apa adanya.** Yang penting dipahami: profil `fast` **bukan
perbaikan** atas `swing`. Ia menghasilkan win rate lebih tinggi (35% vs 28%) tetapi expectancy
lebih buruk dan total rugi jauh lebih besar, karena targetnya lebih dekat (`minRewardRisk`
1.2 vs 2). Dengan R:R ≈ 1.44, win rate impas ≈ `1/(1+1.44)` ≈ **41%** — jadi 35% masih di
bawah impas meski terlihat "lebih sering menang".

#### Biaya transaksi justru menghukum trade cepat

Stop yang rapat membuat fee broker menjadi porsi R yang besar:

| Profil | Rata-rata 1R | Fee round-trip 0.4% | Fee dalam R | Trade | Total seret |
|---|---|---|---|---|---|
| `swing` | 5.14% harga | 0.4% | 0.078 R | 88 | −6.9 R |
| `fast` | 3.53% harga | 0.4% | **0.113 R** | 236 | **−26.7 R** |

Stop `fast` yang lebih rapat (0.9×ATR vs 1.5×ATR) membuat **tiap** trade menanggung fee ~45%
lebih besar dalam satuan R, **dan** frekuensinya 2.7× lebih banyak. Jadi mode cepat adalah
mode yang paling dirugikan biaya — bukan yang paling diuntungkan. Ini aritmetika, bukan
hasil fitting: `fee_dalam_R = fee_persen / jarak_stop_persen`.

> Angka di atas spesifik untuk periode & universe uji ini dan **bukan** klaim kinerja.
> Urutan yang benar bila ingin memakai `fast` secara serius: pisahkan periode in-sample dan
> out-of-sample, masukkan fee/slippage ke dalam perhitungan, baru tuning ambang.

---

## 10. Contoh perhitungan (data nyata ANTM.JK)

Data harian ANTM (5 bar, diambil dari Yahoo Finance):

| # | Tanggal | O | H | L | C | V |
|---|---|---|---|---|---|---|
| 1 | 2026-10-01 | 3200 | 3240 | 3120 | 3120 | 52.025.900 |
| 2 | 2026-10-02 | 3120 | 3170 | 3110 | 3140 | 27.387.000 |
| 3 | 2026-10-05 | 3140 | 3210 | 3100 | 3200 | 38.808.400 |
| 4 | 2026-10-06 | 3200 | 3260 | 3180 | 3250 | 47.928.200 |
| 5 | 2026-10-07 | 3250 | 3260 | 3250 | 3260 | 733.600 |

> Contoh memakai `window = 20` pada hanya 5 bar, jadi baseline **mengembang**
> (mean/std dihitung dari seluruh bar yang tersedia). Angka dibulatkan.

### 10.1 Liquidity Pressure

| # | CLV | `r` | `sd(r)` | `tanh(r/sd)` | RVOL | `LP_raw` | **LPM** |
|---|---|---|---|---|---|---|---|
| 1 | −1.000 | 0 | 0 | 0 | 1.000 | −0.600 | **40.1** |
| 2 | 0.000 | +0.00641 | 0.00453 | +0.888 | 0.690 | +0.245 | **54.1** |
| 3 | +0.818 | +0.01911 | 0.00973 | +0.961 | 0.985 | +0.862 | **64.0** |
| 4 | +0.750 | +0.01563 | 0.00870 | +0.946 | 1.154 | +0.956 | **65.4** |
| 5 | +1.000 | +0.00308 | 0.00820 | +0.359 | 0.022 | +0.016 | **50.3** |

Contoh rinci bar 4: `LP_raw = 1.154 × (0.6×0.750 + 0.4×0.946) = 1.154 × 0.828 = 0.956`,
lalu `LPM = 100/(1+exp(−0.956/1.5)) = 100/(1+e^−0.637) = 65.4` → kecenderungan beli.

Perhatikan bar 5: close tepat di high (`CLV = +1`) **tetapi** volume hanya ~2% dari
rata-rata → `LP_raw ≈ 0` dan LPM kembali ke ~50. Tanpa konfirmasi volume, "close di high"
tidak dianggap tekanan beli kuat.

### 10.2 Intensity

| # | z(V) | z(R) | z(\|r\|) | `Intensity_raw` | **Intensity** |
|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0.000 | **50.0** |
| 2 | −0.707 | −0.707 | +0.707 | −0.424 | **39.5** |
| 3 | −0.049 | +0.415 | +1.090 | +0.318 | **57.9** |
| 4 | +0.585 | −0.454 | +0.614 | +0.279 | **57.0** |
| 5 | −1.589 | −1.502 | −0.704 | −1.386 | **20.0** |

Bar 5 volume anjlok → aktivitas sangat rendah. Bar 3–4 lebih ramai dari biasanya.

### 10.3 Volume Rotation

| # | RVOL | `vc` | `VR_raw` | **Rotation** |
|---|---|---|---|---|
| 1 | 1.000 | 0.0000 | 0.000 | **50.0** |
| 2 | 0.690 | −0.4736 | −0.376 | **38.5** |
| 3 | 0.985 | +0.4170 | +0.158 | **54.9** |
| 4 | 1.154 | +0.2350 | +0.186 | **55.8** |
| 5 | 0.022 | −0.9847 | −0.981 | **22.7** |

### 10.4 Signal engine — contoh kondisi "rally lalu konsolidasi"

5 bar ANTM di atas terlalu pendek untuk SMA50/EMA, jadi ilustrasi signal memakai fixture
deterministik (ada di `tests/signal.test.ts`): **rally 90 bar 260→400**, lalu **25 bar datar
di ~398** dengan volume menurun **1,2 jt → 420 rb**.

| Komponen | Nilai | Label |
|---|---|---|
| Trend | +0.33 (close ≈ +0.2% vs SMA20, ≈ +2.4% vs SMA50, SMA20 > SMA50) | **Bullish** |
| Momentum | +0.06 (slope LPM −0.13) | **Cooling** |
| Volume | −0.71 (SMA(V,5)/SMA(V,20) = 0.67) | **Contracting** |
| Risk | 0.225 (terutama divergensi trend vs momentum) | **Moderate** |
| Strength | 30.5 | **Moderate** |

Aturan → trend Bullish + (Cooling/Contracting) → **Bullish Consolidation**, dengan penjelasan
"Trend harga masih bullish …, namun momentum dan volume sedang mendingin (kontraksi) …".
Ini **bukan** bearish: tekanan jual tidak terkonfirmasi (volume jual tidak meningkat).

Sebagai kontras, bila close jatuh **di bawah** SMA20 **dan** SMA20 di bawah SMA50 (trend
Bearish) dengan momentum Weak dan volume ekspansi → **Strong Selling**.

---

## 11. Keterbatasan formula

- Bukan prediksi harga; hanya deskripsi tekanan/aktivitas volume-harga historis.
- Sensitif terhadap kualitas data: volume 0 (saham tidak likuid) atau gap hari libur
  dapat mendistorsi `RVOL`.
- `window` kecil → lebih responsif tapi lebih berisik; `window` besar → lebih halus tapi lambat.
- `scale` menentukan seberapa cepat skor jenuh; ubah di `config.ts` bila perlu kalibrasi.
- Nilai tetap 0–100 agar mudah dibaca, tetapi **tidak** dapat dibandingkan langsung
  antar saham yang karakter volatilitasnya sangat berbeda (Intensity khususnya bersifat relatif).
- Signal engine memakai SMA50, sehingga butuh **≥ 50 bar**; pada histori lebih pendek komponen
  SMA50 dilewati dan trend lebih bergantung pada SMA20/slope.
- Ambang & bobot signal engine adalah **heuristik yang dapat diubah**, bukan hasil optimisasi
  statistik. `Strength` adalah ukuran kesepakatan komponen, **bukan** probabilitas.
- Trade Plan bergantung pada ATR & pivot; **horizon adalah estimasi**, bukan jadwal pasti.
  Backtest walk-forward (§9) tersedia, namun bersifat **in-sample, tanpa biaya, dan ambangnya
  belum di-tuning** — ia mengukur perilaku, bukan menjanjikan hasil. Bukan rekomendasi investasi.
- Trade Plan hanya menghasilkan arah **Long** (tidak menangani short-selling).
