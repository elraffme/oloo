import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  RefreshCw 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface WithdrawalWithUser {
  id: string;
  user_id: string;
  token_amount: number;
  cash_amount_cents: number;
  status: 'pending' | 'completed' | 'rejected';
  admin_notes?: string;
  created_at: string;
  processed_at?: string;
}

const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalWithUser | null>(null);
  const [actionType, setActionType] = useState<'complete' | 'reject'>('complete');
  const [adminNotes, setAdminNotes] = useState('');
  const { toast } = useToast();

  const fetchWithdrawals = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals((data as WithdrawalWithUser[]) || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast({
        title: "Error",
        description: "Failed to load withdrawals",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const openActionDialog = (withdrawal: WithdrawalWithUser, action: 'complete' | 'reject') => {
    setSelectedWithdrawal(withdrawal);
    setActionType(action);
    setAdminNotes('');
    setShowDialog(true);
  };

  const handleAction = async () => {
    if (!selectedWithdrawal) return;
    
    setProcessingId(selectedWithdrawal.id);
    try {
      const functionName = actionType === 'complete' ? 'complete_withdrawal' : 'reject_withdrawal';
      const { error } = await supabase.rpc(functionName, {
        p_withdrawal_id: selectedWithdrawal.id,
        p_admin_notes: adminNotes || null
      });

      if (error) throw error;

      toast({
        title: actionType === 'complete' ? "Withdrawal Completed" : "Withdrawal Rejected",
        description: actionType === 'complete' 
          ? "The withdrawal has been marked as completed" 
          : "The withdrawal has been rejected and tokens refunded",
      });

      await fetchWithdrawals();
      setShowDialog(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to process withdrawal';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-500 border-red-500"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          <CardTitle>Withdrawal Requests</CardTitle>
          {pendingCount > 0 && (
            <Badge variant="destructive">{pendingCount} pending</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchWithdrawals} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : withdrawals.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No withdrawal requests
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((withdrawal) => (
                <TableRow key={withdrawal.id}>
                  <TableCell className="text-sm">
                    {format(new Date(withdrawal.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {withdrawal.user_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{withdrawal.token_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-green-500 font-medium">
                    ${(withdrawal.cash_amount_cents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                  <TableCell>
                    {withdrawal.status === 'pending' ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-500 border-green-500 hover:bg-green-500/10"
                          onClick={() => openActionDialog(withdrawal, 'complete')}
                          disabled={processingId === withdrawal.id}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 border-red-500 hover:bg-red-500/10"
                          onClick={() => openActionDialog(withdrawal, 'reject')}
                          disabled={processingId === withdrawal.id}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {withdrawal.processed_at && format(new Date(withdrawal.processed_at), 'MMM d')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Action Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'complete' ? 'Complete Withdrawal' : 'Reject Withdrawal'}
              </DialogTitle>
            </DialogHeader>
            {selectedWithdrawal && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Amount:</span>{' '}
                    <span className="font-medium">
                      {selectedWithdrawal.token_amount.toLocaleString()} tokens = ${(selectedWithdrawal.cash_amount_cents / 100).toFixed(2)}
                    </span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Admin Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this action..."
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button
                variant={actionType === 'complete' ? 'default' : 'destructive'}
                onClick={handleAction}
                disabled={processingId !== null}
              >
                {processingId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : actionType === 'complete' ? (
                  'Mark Complete'
                ) : (
                  'Reject & Refund'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AdminWithdrawals;
