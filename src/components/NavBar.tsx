"use client";

import { useRef, type KeyboardEvent } from "react";
import { setTab, TABS, useAppTab } from "@/lib/utils/nav";

export function NavBar() {
  const active = useAppTab();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  // Panah kiri/kanan + Home/End, sesuai pola ARIA tabs dengan roving tabindex.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    let next = -1;

    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next < 0) return;

    event.preventDefault();
    refs.current[next]?.focus();
    setTab(TABS[next].id);
  };

  return (
    <nav aria-label="Bagian aplikasi" className="overflow-x-auto py-2">
      <div
        role="tablist"
        className="inline-flex items-center gap-1.5 rounded-xl border border-line/60 bg-surface-elevated/40 p-1 shadow-inner backdrop-blur-md"
      >
        {TABS.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              title={tab.hint}
              onClick={() => setTab(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                selected
                  ? "bg-accent text-accent-fg shadow-md shadow-accent/20"
                  : "text-fg-subtle hover:bg-surface-elevated hover:text-fg"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
