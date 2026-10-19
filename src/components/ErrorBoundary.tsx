"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Label opsional untuk konteks error (mis. nama panel). */
  context?: string;
}

interface State {
  error: Error | null;
}

/**
 * Menangkap exception yang dilempar oleh komponen child — termasuk crash
 * saat computeIndicators memproses data corrupt dari API.
 * Harus berupa class component karena getDerivedStateFromError hanya tersedia di class.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log ke console agar mudah di-debug; bisa diganti dengan error reporting service.
    console.error("[ErrorBoundary]", this.props.context ?? "App", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-down/30 bg-down/5 px-4 py-12 text-center"
        >
          <p className="text-sm font-semibold text-down">
            {this.props.context ? `Terjadi kesalahan di ${this.props.context}` : "Terjadi kesalahan"}
          </p>
          <p className="max-w-md text-sm text-fg-muted">
            {this.state.error.message || "Komponen mengalami error yang tidak terduga."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-down/40 bg-down/10 px-4 py-1.5 text-sm font-medium text-down transition hover:bg-down/20"
          >
            Muat ulang halaman
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
