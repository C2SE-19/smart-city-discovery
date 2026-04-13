import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // You can also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h1 className="error-title">Oops! Something went wrong</h1>
            <p className="error-message">
              Ứng dụng gặp một lỗi không mong muốn. Vui lòng tải lại trang hoặc thử lại.
            </p>

            {import.meta.env.DEV && (
              <details className="error-details">
                <summary>Chi tiết lỗi (Chế độ Development)</summary>
                <div className="error-stack">
                  <p className="error-text">
                    <strong>Error:</strong> {this.state.error?.toString()}
                  </p>
                  <pre className="error-trace">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              </details>
            )}

            <div className="error-actions">
              <button
                className="error-btn error-btn-primary"
                onClick={this.handleReset}
              >
                Thử lại
              </button>
              <button
                className="error-btn error-btn-secondary"
                onClick={() => window.location.href = '/'}
              >
                Về trang chủ
              </button>
            </div>

            {this.state.errorCount > 5 && (
              <p className="error-warning">
                Ứng dụng liên tục gặp sự cố. Vui lòng xóa cache hoặc liên hệ với hỗ trợ.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
