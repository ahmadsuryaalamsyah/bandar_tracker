import { describe, expect, it } from "vitest";
import { analyzeVsa } from "@/lib/indicators/vsa";
import type { Candle } from "@/lib/indicators/types";

describe("analyzeVsa", () => {
  it("mengembalikan empty jika bar kurang dari 5", () => {
    const res = analyzeVsa([]);
    expect(res.hasPattern).toBe(false);
  });

  it("mendeteksi Stopping Volume (Absorption Bottom)", () => {
    // 10 bar normal
    const bars: Candle[] = Array.from({ length: 10 }, (_, i) => ({
      t: i,
      o: 1000,
      h: 1010,
      l: 990,
      c: 1000,
      v: 1000,
    }));

    // Bar ke-11: Volume meledak 3x, harga jatuh tapi ada rejection ekor bawah panjang
    bars.push({
      t: 11,
      o: 990,
      h: 995,
      l: 920,
      c: 980, // close dekat high, ekor bawah dari 920 ke 980 (60 poin dari 75 poin range)
      v: 3000, // volume meledak 3x
    });

    const res = analyzeVsa(bars);
    expect(res.hasPattern).toBe(true);
    expect(res.type).toBe("stopping_volume");
    expect(res.actionBias).toBe("Bullish");
  });

  it("mendeteksi Upthrust (Fake Breakout)", () => {
    // 10 bar normal
    const bars: Candle[] = Array.from({ length: 10 }, (_, i) => ({
      t: i,
      o: 1000,
      h: 1010,
      l: 990,
      c: 1000,
      v: 1000,
    }));

    // Bar ke-11: High menembus 1080 dengan volume tinggi, tapi tutup anjlok di 995
    bars.push({
      t: 11,
      o: 1005,
      h: 1080,
      l: 990,
      c: 995,
      v: 2500, // volume 2.5x lipat
    });

    const res = analyzeVsa(bars);
    expect(res.hasPattern).toBe(true);
    expect(res.type).toBe("upthrust");
    expect(res.actionBias).toBe("Bearish");
  });
});
