import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    // Clear cache and reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--background)',
            padding: '20px',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '32px',
              borderRadius: '12px',
              backgroundColor: 'white',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                color: 'var(--primary)',
                marginBottom: '16px',
              }}
            >
              Oops! Something went wrong
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: '24px',
              }}
            >
              {this.state.error?.message?.includes('WebAssembly') || 
               this.state.error?.message?.includes('Network')
                ? 'There was a network or caching issue. Please clear your browser cache and try again.'
                : 'An unexpected error occurred. Please refresh the page.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Clear Cache & Reload
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--secondary)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Just Reload
              </button>
            </div>
            {this.state.error && (
              <details style={{ marginTop: '24px', textAlign: 'left' }}>
                <summary
                  style={{
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                  }}
                >
                  Error Details
                </summary>
                <pre
                  style={{
                    marginTop: '8px',
                    padding: '12px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '6px',
                    fontSize: '12px',
                    overflow: 'auto',
                    color: '#666',
                  }}
                >
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
