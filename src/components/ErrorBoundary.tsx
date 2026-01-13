import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到错误:', error);
    console.error('[ErrorBoundary] 错误信息:', errorInfo);
    console.error('[ErrorBoundary] 错误堆栈:', error.stack);
    console.error('[ErrorBoundary] 组件堆栈:', errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#dc3545',
          backgroundColor: '#fff',
          border: '1px solid #dc3545',
          borderRadius: '4px',
          margin: '20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ marginBottom: '16px' }}>组件渲染错误</h2>
          
          {this.state.error && (
            <div style={{
              textAlign: 'left',
              backgroundColor: '#f8f9fa',
              padding: '16px',
              borderRadius: '4px',
              marginTop: '16px',
              fontSize: '12px',
              fontFamily: 'monospace',
              overflow: 'auto',
              maxHeight: '300px'
            }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>错误信息:</div>
              <div style={{ marginBottom: '16px', color: '#dc3545' }}>
                {this.state.error.toString()}
              </div>
              
              {this.state.error.stack && (
                <>
                  <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>错误堆栈:</div>
                  <pre style={{ 
                    margin: 0, 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    color: '#666'
                  }}>
                    {this.state.error.stack}
                  </pre>
                </>
              )}
              
              {this.state.errorInfo && this.state.errorInfo.componentStack && (
                <>
                  <div style={{ marginBottom: '8px', marginTop: '16px', fontWeight: 'bold' }}>
                    组件堆栈:
                  </div>
                  <pre style={{ 
                    margin: 0, 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    color: '#666'
                  }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </>
              )}
            </div>
          )}
          
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            重新加载页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
