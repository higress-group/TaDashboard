'use client';

import { Component, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { SurfaceShell } from '@/components/dashboard/surface-shell';
import { Button } from '@/components/ui/button';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  /** Display name so the fallback can identify the section. */
  title?: string;
  /** Alias for `title`, kept for caller readability. */
  sectionName?: string;
}

interface SectionErrorBoundaryState {
  error: Error | null;
}

/**
 * Localized React error boundary for dashboard sections. A failure in
 * one panel does not break the rest of the page; users get a "重试"
 * button that clears the state and re-renders the subtree.
 */
export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  state: SectionErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string }): void {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[SectionErrorBoundary]', error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const label = this.props.title ?? this.props.sectionName;
    return (
      <SurfaceShell className="border-rose-500/30" contentClassName="p-4 flex items-start gap-2" role="alert">
        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {label ? `${label} 加载失败：` : '本区块加载失败：'}
            {this.state.error.message}
          </p>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] mt-1" onClick={this.reset} aria-label="重试加载本区块">
            <RotateCcw className="w-3 h-3 mr-1" aria-hidden="true" />
            重试
          </Button>
        </div>
      </SurfaceShell>
    );
  }
}
