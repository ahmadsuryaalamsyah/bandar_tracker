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
    <nav aria-label="Bagian aplikasi" className="overflow-x-auto">
      <div role="tablist" className="flex gap-1">
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
              className={`border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                selected
                  ? "border-accent text-fg"
                  : "border-transparent text-fg-subtle hover:border-line-strong hover:text-fg-muted"
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
