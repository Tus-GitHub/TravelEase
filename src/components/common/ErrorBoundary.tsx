"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Shown instead of `children` if a render/runtime error is thrown below. */
  fallback: ReactNode;
  /** Optional hook for logging. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

/**
 * Generic client error boundary (§34). Used to isolate optional visual layers
 * — the WebGL vehicle scene above all — so a failure there degrades to a
 * static fallback instead of taking down the page.
 */
export default class ErrorBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    if (process.env.NODE_ENV !== "production") {
      console.warn("ErrorBoundary caught:", error);
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
