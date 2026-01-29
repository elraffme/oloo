import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class StreamErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔴 Stream Error Boundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  private handleClose = () => {
    this.setState({ hasError: false, error: null });
    this.props.onClose?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="text-center p-6 max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            
            <h2 className="text-xl font-semibold text-white mb-2">
              Stream Error
            </h2>
            
            <p className="text-muted-foreground mb-6">
              Something went wrong while loading the stream. This might be a temporary issue.
            </p>
            
            {this.state.error && (
              <p className="text-xs text-muted-foreground/60 mb-6 font-mono bg-muted/10 p-2 rounded">
                {this.state.error.message}
              </p>
            )}
            
            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline" 
                onClick={this.handleClose}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Leave Stream
              </Button>
              
              <Button 
                onClick={this.handleRetry}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default StreamErrorBoundary;
