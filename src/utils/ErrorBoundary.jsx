import React from 'react';

/**
 * Error Boundary component to catch JavaScript errors in child components
 * and display a fallback UI instead of crashing the entire application
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {hasError: false, error: null, errorInfo: null};
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return {hasError: true, error};
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to the console
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
        this.setState({errorInfo});

        // Optionally log to an error reporting service
        // logErrorToService(error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Render custom fallback UI if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="error-boundary">
                    <h3>Something went wrong</h3>
                    <div className="error-details">
                        {this.state.error?.message || 'Unknown error'}
                    </div>
                    {this.state.errorInfo && (
                        <details>
                            <summary>Stack Trace</summary>
                            <pre>{this.state.errorInfo.componentStack}</pre>
                        </details>
                    )}
                    {this.props.showReset && (
                        <button
                            onClick={() => this.setState({hasError: false, error: null, errorInfo: null})}
                        >
                            Try Again
                        </button>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;