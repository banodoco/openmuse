import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode; // Optional fallback UI prop
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  // Update state so the next render will show the fallback UI.
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // You can also log the error to an error reporting service
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // TODO: Log error to a reporting service like Sentry, LogRocket, etc.
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div className="w-full min-h-[300px] flex flex-col items-center justify-center text-destructive border border-destructive rounded-md p-4 m-4 bg-destructive/10">
            <h2 className="text-lg font-semibold mb-2">Something went wrong.</h2>
            <p className="text-sm mb-4">An unexpected error occurred. Please try refreshing the page.</p>
            {/* Optionally display error details in development */}
            {import.meta.env.DEV && this.state.error && (
                <pre className="text-xs whitespace-pre-wrap bg-background/50 p-2 rounded">
                    <code>{this.state.error.toString()}</code>
                </pre>
            )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 