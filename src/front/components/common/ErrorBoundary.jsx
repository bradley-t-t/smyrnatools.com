import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    try {
      localStorage.setItem('react_error_boundary', JSON.stringify({
        timestamp: new Date().toISOString(),
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack
      }));
    } catch (e) {
    }

    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
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

    return this.props.children;
  }
}

export default ErrorBoundary;