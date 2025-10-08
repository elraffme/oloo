import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Eye, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentAuditLog {
  id: string;
  operation_type: string;
  payment_intent_id: string | null;
  user_id: string | null;
  old_status: string | null;
  new_status: string | null;
  amount_cents: number | null;
  metadata: any;
  ip_address: unknown;
  user_agent: string | null;
  created_at: string;
}

export const PaymentSecurityAudit = () => {
  const [auditLogs, setAuditLogs] = useState<PaymentAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      setAuditLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Error Loading Audit Logs",
        description: "Failed to load payment audit logs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const getOperationBadgeVariant = (operation: string) => {
    switch (operation) {
      case 'create':
        return 'default';
      case 'update_status':
        return 'secondary';
      case 'retrieve':
        return 'outline';
      case 'webhook_update':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatAmount = (amountCents?: number) => {
    if (!amountCents) return 'N/A';
    return `$${(amountCents / 100).toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-600" />
          <CardTitle>Payment Security Audit</CardTitle>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            <Eye className="w-4 h-4 mr-2" />
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAuditLogs}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            ✅ <strong>Security Enhanced:</strong> Payment data is now protected with secure RLS policies, 
            comprehensive audit logging, and restricted access controls. All payment operations are 
            validated and logged for security compliance.
          </AlertDescription>
        </Alert>

        {auditLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No payment operations logged yet.
          </div>
        ) : (
          <div className="space-y-2">
            <h4 className="font-medium">Recent Payment Operations</h4>
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={getOperationBadgeVariant(log.operation_type)}>
                    {log.operation_type}
                  </Badge>
                  {showDetails && (
                    <div className="text-sm text-muted-foreground space-x-2">
                      {log.payment_intent_id && (
                        <span>ID: {log.payment_intent_id.substring(0, 8)}...</span>
                      )}
                      {log.amount_cents && (
                        <span>Amount: {formatAmount(log.amount_cents)}</span>
                      )}
                      {log.ip_address && (
                        <span>IP: {String(log.ip_address)}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {showDetails && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Features Implemented:</strong>
              <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                <li>All payment operations require authentication and validation</li>
                <li>Amount limits enforced per membership tier</li>
                <li>Comprehensive audit logging with IP tracking</li>
                <li>Service operations isolated from user operations</li>
                <li>RLS policies prevent unauthorized data access</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};