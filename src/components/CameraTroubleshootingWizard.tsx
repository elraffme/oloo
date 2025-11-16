import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCameraDiagnostics, DiagnosticResult } from '@/hooks/useCameraDiagnostics';
import { Camera, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CameraTroubleshootingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CameraTroubleshootingWizard = ({ open, onOpenChange }: CameraTroubleshootingWizardProps) => {
  const { isRunning, results, currentStep, runFullDiagnostics, reset } = useCameraDiagnostics();

  const handleStart = () => {
    reset();
    runFullDiagnostics();
  };

  const getStepProgress = () => {
    if (currentStep === 'idle') return 0;
    if (currentStep === 'permissions') return 33;
    if (currentStep === 'resolution') return 66;
    if (currentStep === 'capture' || currentStep === 'complete') return 100;
    return 0;
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'pending':
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-500/50 bg-green-500/10';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/10';
      case 'error':
        return 'border-destructive/50 bg-destructive/10';
      default:
        return 'border-border bg-card';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Camera Troubleshooting
          </DialogTitle>
          <DialogDescription>
            Diagnose and fix common camera issues before streaming
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {currentStep === 'idle' ? (
            <div className="text-center py-8 space-y-4">
              <Camera className="h-16 w-16 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                This wizard will test your camera permissions, resolution capabilities, and video capture quality.
              </p>
              <Button onClick={handleStart} size="lg">
                Start Diagnostics
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {currentStep === 'complete' ? 'Complete' : 'Running diagnostics...'}
                  </span>
                  <span className="text-muted-foreground">{getStepProgress()}%</span>
                </div>
                <Progress value={getStepProgress()} />
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-all ${getStatusColor(result.status)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getStatusIcon(result.status)}
                      <div className="flex-1 space-y-2">
                        <div className="font-medium">{result.message}</div>
                        
                        {result.details && (
                          <div className="text-sm text-muted-foreground font-mono">
                            {typeof result.details === 'object' ? (
                              Object.entries(result.details).map(([key, value]) => (
                                <div key={key}>
                                  {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </div>
                              ))
                            ) : (
                              String(result.details)
                            )}
                          </div>
                        )}

                        {result.suggestion && (
                          <Alert className="mt-2">
                            <AlertDescription className="text-sm">
                              💡 {result.suggestion}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isRunning && (
                  <div className="flex items-center gap-2 text-muted-foreground p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Testing {currentStep}...</span>
                  </div>
                )}
              </div>

              {currentStep === 'complete' && (
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={handleStart} className="flex-1">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run Again
                  </Button>
                  <Button onClick={() => onOpenChange(false)} className="flex-1">
                    Done
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraTroubleshootingWizard;
