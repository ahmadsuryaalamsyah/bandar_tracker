/**
 * Universe screening IDX.
 *
 * 227 kode, **diverifikasi satu per satu** ke provider (Yahoo) — kode yang
 * tidak mengembalikan data historis sudah dibuang, jadi daftar ini tidak memuat
 * emiten yang sudah delisted/suspended.
 *
 * Ini tetap **bukan seluruh pasar** (IDX punya ratusan emiten): penyedia data kita
 * tidak menyediakan direktori simbol, dan setiap kode = satu permintaan upstream
 * yang dibatasi rate limit. Yang ada di sini adalah kumpulan likuid yang bisa
 * dipindai dalam hitungan detik.
 *
 * Urutan disengaja: nama paling likuid di depan, sehingga bila pemindaian
 * terpotong, yang terpenting sudah terperiksa.
 *
 * Terakhir diverifikasi: 2026-10-15. Untuk menyegarkan, jalankan ulang
 * verifikasi terhadap `/api/ohlcv` lalu buang kode yang gagal.
 */
export const DEFAULT_UNIVERSE: readonly string[] = [
  "BBCA", "BBRI", "BMRI", "BBNI", "TLKM", "ASII", "ANTM", "MDKA",
  "INDF", "ICBP", "UNVR", "KLBF", "SMGR", "INTP", "ADRO", "PTBA",
  "ITMG", "PGAS", "EXCL", "ISAT", "GOTO", "BRPT", "AMRT", "TPIA",
  "AALI", "ACES", "ACST", "ADHI", "ADMR", "AGRO", "AISA", "AKRA",
  "ALKA", "AMAR", "AMFG", "ANJT", "APLN", "ARCI", "ARNA", "ARTO",
  "ASRI", "ASSA", "AUTO", "BACA", "BAPA", "BBHI", "BBKP", "BBMD",
  "BBSI", "BBTN", "BBYB", "BCAP", "BCIC", "BDMN", "BEKS", "BEST",
  "BIRD", "BJBR", "BJTM", "BKSW", "BLTA", "BMAS", "BMHS", "BNBA",
  "BNGA", "BOGA", "BRAM", "BRIS", "BSDE", "BSSR", "BSWD", "BTPS",
  "BUDI", "BUKA", "BULL", "BUMI", "BWPT", "BYAN", "CAMP", "CITA",
  "CITY", "CPIN", "CSAP", "CTRA", "DEWA", "DGIK", "DGNS", "DILD",
  "DLTA", "DMAS", "DOID", "DPNS", "DSNG", "DSSA", "DVLA", "ELSA",
  "EMTK", "ENRG", "ERAA", "ESSA", "FILM", "FIRE", "GEMS", "GGRM",
  "GIAA", "GJTL", "GOOD", "GTBO", "GWSA", "HAIS", "HEAL", "HERO",
  "HITS", "HMSP", "HRTA", "HRUM", "IATA", "IKAI", "IMAS", "INAF",
  "INCI", "INCO", "INDS", "INDY", "INPC", "IPCC", "IPCM", "IPTV",
  "ISSP", "ITMA", "JPFA", "JSMR", "KAEF", "KBLI", "KDSI", "KIJA",
  "KJEN", "KKGI", "KOIN", "KOTA", "KRAS", "LEAD", "LION", "LPIN",
  "LPKR", "LPPF", "LSIP", "LTLS", "MAIN", "MAPA", "MAPI", "MASB",
  "MBMA", "MCOR", "MEDC", "MEGA", "MERK", "MIDI", "MIKA", "MLBI",
  "MNCN", "MSIN", "MTEL", "MTLA", "MYOH", "MYOR", "NCKL", "NIKL",
  "NISP", "NOBU", "NRCA", "PALM", "PANS", "PBRX", "PBSA", "PGEO",
  "PLIN", "PNBN", "PRDA", "PSAB", "PSSI", "PTPP", "PTRO", "PWON",
  "PYFA", "RAJA", "RALS", "RANC", "RDTX", "RODA", "ROTI", "SAFE",
  "SAME", "SCMA", "SDRA", "SGER", "SGRO", "SIDO", "SILO", "SIMP",
  "SMBR", "SMCB", "SMDR", "SMMT", "SMRA", "SMSM", "SOCI", "SRAJ",
  "SSMS", "STTP", "TBIG", "TBLA", "TINS", "TMAS", "TOBA", "TOTL",
  "TOTO", "TOWR", "TRIS", "TSPC", "ULTJ", "UNIC", "WEHA", "WIIM",
  "WIKA", "WSBP", "ZINC",
];
