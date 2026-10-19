import { describe, expect, it } from "vitest";
import { isAppTab, tabFromHash, TABS } from "@/lib/utils/nav";

describe("daftar tab", () => {
  it("id unik, berlabel, dan punya keterangan", () => {
    const ids = TABS.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tab of TABS) {
      expect(tab.id).toMatch(/^[a-z]+$/);
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.hint.length).toBeGreaterThan(0);
    }
  });

  it("isAppTab menolak nilai tak dikenal", () => {
    expect(isAppTab("analysis")).toBe(true);
    expect(isAppTab("watchlist")).toBe(true);
    expect(isAppTab("portfolio")).toBe(false);
    expect(isAppTab("")).toBe(false);
  });
});

describe("tabFromHash", () => {
  it("menerima format dengan dan tanpa garis miring", () => {
    expect(tabFromHash("#/screener")).toBe("screener");
    expect(tabFromHash("#screener")).toBe("screener");
    expect(tabFromHash("#/watchlist")).toBe("watchlist");
  });

  it("jatuh ke tab default saat hash kosong atau tidak dikenal", () => {
    expect(tabFromHash("")).toBe("analysis");
    expect(tabFromHash("#")).toBe("analysis");
    expect(tabFromHash("#/bukan-tab")).toBe("analysis");
    expect(tabFromHash("#/../../etc/passwd")).toBe("analysis");
  });
});
