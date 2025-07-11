import React from 'react';

/**
 * ErrorBoundary component to catch errors in the component tree
 * and display a fallback UI instead of crashing the whole app
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to the console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Store error details for debugging
    try {
      localStorage.setItem('react_error_boundary', JSON.stringify({
        timestamp: new Date().toISOString(),
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack
      }));
    } catch (e) {
      console.error('Could not save error details to localStorage:', e);
    }

    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <h2>Something went wrong</h2>
            <p>We apologize for the inconvenience. Please try reloading the page.</p>
            {process.env.NODE_ENV === 'development' && (
              <div className="error-details">
                <h3>Error Details (Development Only)</h3>
                <p>{this.state.error && this.state.error.toString()}</p>
                <pre>{this.state.error && this.state.error.stack}</pre>
                <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
              </div>
            )}
            <button onClick={() => window.location.reload()} className="reload-button">
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    // When there's no error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;
