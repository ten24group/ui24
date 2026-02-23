import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
  panelName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`DevTools Panel Error (${this.props.panelName}):`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 12 }}>
          <Alert
            type="error"
            message="Panel Crashed"
            description={
              <div style={{ fontSize: 11, marginTop: 4 }}>
                <div>{this.state.error?.message}</div>
                <Button
                  size="small"
                  type="primary"
                  danger
                  icon={<ReloadOutlined />}
                  onClick={this.handleRetry}
                  style={{ marginTop: 8 }}
                >
                  Retry Panel
                </Button>
              </div>
            }
            showIcon
          />
        </div>
      );
    }

    return this.props.children;
  }
}
