import { Component, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface State {
  error: Error | null;
}

/**
 * Root-level error boundary. Prevents render-time exceptions from producing a
 * blank white screen — especially when the app is opened in a new tab and a
 * transient hydration/auth error would otherwise crash the tree.
 */
export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error);
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  };

  reset = () => {
    if (this.state.error) this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return (
        <>
          <ErrorBoundaryResetOnNavigate onNavigate={this.reset} />
          {this.props.children}
        </>
      );
    }
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background text-foreground">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The app hit an unexpected error while loading this page. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Clears a stale captured error the moment the URL changes. Without this a
 * transient error on one route would keep every subsequent page stuck on the
 * "Something went wrong" screen until the user manually reloads.
 */
function ErrorBoundaryResetOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const location = useLocation();
  useEffect(() => { onNavigate(); }, [location.pathname, location.search, onNavigate]);
  return null;
}