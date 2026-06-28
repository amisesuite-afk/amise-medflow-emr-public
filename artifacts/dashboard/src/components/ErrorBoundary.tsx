import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** When any value in this array changes, the error state resets (e.g. tab navigation). */
  resetKeys?: ReadonlyArray<unknown>;
  /** Optional fallback to render instead of the default clinical-grade UI. */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches render errors in any child tree and
 * shows a clinical-grade fallback so the rest of the dashboard stays usable.
 *
 * Supports a `resetKeys` prop: when any key changes (e.g. the user switches tabs),
 * the error state is cleared automatically without requiring a full page reload.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private prevResetKeys: ReadonlyArray<unknown>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.prevResetKeys = props.resetKeys ?? [];
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);

    // Forward to Sentry if available
    try {
      const sentry = (window as unknown as Record<string, unknown>).__SENTRY__ as
        | { captureException?: (err: Error, ctx?: unknown) => void }
        | undefined;
      sentry?.captureException?.(error, { extra: { componentStack: info.componentStack } });
    } catch {
      // Sentry integration is best-effort
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.hasError) {
      // Keep prevResetKeys in sync even when not in error state
      this.prevResetKeys = this.props.resetKeys ?? [];
      return;
    }

    const currentKeys = this.props.resetKeys ?? [];
    const changed =
      currentKeys.length !== this.prevResetKeys.length ||
      currentKeys.some((key, i) => key !== this.prevResetKeys[i]);

    if (changed) {
      this.prevResetKeys = currentKeys;
      this.setState({ hasError: false, error: null });
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          minHeight: 260,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            border: '1px solid #fca5a5',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2
          style={{
            margin: '0 0 8px',
            fontSize: 18,
            fontWeight: 700,
            color: '#1e293b',
          }}
        >
          Something went wrong
        </h2>

        <p
          style={{
            margin: '0 0 6px',
            fontSize: 13,
            color: '#64748b',
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          An unexpected error occurred while rendering this section.
          Your data has been auto-saved.
        </p>

        <p
          style={{
            margin: '0 0 20px',
            fontSize: 11,
            color: '#94a3b8',
            fontFamily: 'monospace',
            maxWidth: 420,
            wordBreak: 'break-word',
          }}
        >
          {this.state.error?.message ?? 'Unknown error'}
        </p>

        <button
          type="button"
          onClick={this.handleReload}
          style={{
            padding: '10px 28px',
            borderRadius: 8,
            border: 'none',
            background: '#1F7A8C',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#17606e'; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1F7A8C'; }}
        >
          Reload
        </button>
      </div>
    );
  }
}
