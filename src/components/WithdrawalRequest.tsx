import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Coins, DollarSign, ArrowRight, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useWithdrawals, Withdrawal } from '@/hooks/useWithdrawals';
import { useCurrency } from '@/hooks/useCurrency';
import { format } from 'date-fns';

const WithdrawalRequest = () => {
  const [tokenAmount, setTokenAmount] = useState<string>('');
  const { 
    withdrawals, 
    isLoading, 
    requestWithdrawal, 
    calculateCashAmount,
    conversionRate,
    minWithdrawalTokens 
  } = useWithdrawals();
  const { balance } = useCurrency();

  const tokens = parseInt(tokenAmount) || 0;
  const cashPreview = calculateCashAmount(tokens);
  const canWithdraw = tokens >= minWithdrawalTokens && tokens <= (balance?.coin_balance || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWithdraw) return;
    
    const success = await requestWithdrawal(tokens);
    if (success) {
      setTokenAmount('');
    }
  };

  const getStatusBadge = (status: Withdrawal['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-500 border-red-500"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Withdrawal Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Request Withdrawal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Balance Display */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">Available Balance</span>
              <div className="flex items-center gap-1 font-semibold">
                <Coins className="w-4 h-4 text-yellow-500" />
                {balance?.coin_balance?.toLocaleString() || 0} tokens
              </div>
            </div>

            {/* Token Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="tokenAmount">Token Amount</Label>
              <Input
                id="tokenAmount"
                type="number"
                min={minWithdrawalTokens}
                max={balance?.coin_balance || 0}
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder={`Min ${minWithdrawalTokens} tokens`}
              />
            </div>

            {/* Conversion Preview */}
            {tokens > 0 && (
              <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="text-center">
                  <div className="flex items-center gap-1 font-bold text-lg">
                    <Coins className="w-5 h-5 text-yellow-500" />
                    {tokens.toLocaleString()}
                  </div>
                  <span className="text-xs text-muted-foreground">tokens</span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
                <div className="text-center">
                  <div className="flex items-center gap-1 font-bold text-lg text-green-500">
                    <DollarSign className="w-5 h-5" />
                    {cashPreview.toFixed(2)}
                  </div>
                  <span className="text-xs text-muted-foreground">USD</span>
                </div>
              </div>
            )}

            {/* Rate Info */}
            <p className="text-xs text-muted-foreground text-center">
              Conversion rate: 1 token = ${conversionRate.toFixed(2)} USD
            </p>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!canWithdraw || isLoading}
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <>Request Withdrawal</>
              )}
            </Button>

            {tokens > 0 && tokens < minWithdrawalTokens && (
              <p className="text-xs text-destructive text-center">
                Minimum withdrawal: {minWithdrawalTokens} tokens (${(minWithdrawalTokens * conversionRate).toFixed(2)})
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Withdrawal History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Withdrawal History</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No withdrawal requests yet
            </p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((withdrawal) => (
                <div 
                  key={withdrawal.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {withdrawal.token_amount.toLocaleString()} tokens
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-green-500 font-medium">
                        ${(withdrawal.cash_amount_cents / 100).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(withdrawal.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(withdrawal.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WithdrawalRequest;
