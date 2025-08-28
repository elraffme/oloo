import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, Gift, Trophy, UserCheck, RefreshCw, Shield } from 'lucide-react';
import { useSecureTokens } from '@/hooks/useSecureTokens';
import { Alert, AlertDescription } from '@/components/ui/alert';

const SecureTokenManager = () => {
  const [balance, setBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const { 
    loading, 
    transactions, 
    getTokenBalance, 
    getTransactionHistory, 
    awardUserTokens,
    canPerformTokenOperation 
  } = useSecureTokens();

  // Refresh token data
  const refreshData = async () => {
    setRefreshing(true);
    try {
      const newBalance = await getTokenBalance();
      setBalance(newBalance);
      await getTransactionHistory();
    } finally {
      setRefreshing(false);
    }
  };

  // Load initial data
  useEffect(() => {
    refreshData();
  }, []);

  // Handle token rewards
  const handleAwardTokens = async (
    amount: number, 
    reason: 'gift_received' | 'daily_bonus' | 'profile_completion'
  ) => {
    const canProceed = await canPerformTokenOperation(amount);
    if (!canProceed) return;

    const success = await awardUserTokens(amount, reason);
    if (success) {
      await refreshData();
    }
  };

  // Format transaction reason for display
  const formatReason = (reason: string) => {
    return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get transaction type icon
  const getTransactionIcon = (reason: string, delta: number) => {
    if (delta > 0) {
      switch (reason) {
        case 'gift_received':
          return <Gift className="w-4 h-4 text-green-600" />;
        case 'daily_bonus':
          return <Trophy className="w-4 h-4 text-blue-600" />;
        case 'profile_completion':
          return <UserCheck className="w-4 h-4 text-purple-600" />;
        default:
          return <Coins className="w-4 h-4 text-green-600" />;
      }
    }
    return <Coins className="w-4 h-4 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Security Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          🔒 Your token transactions are now secured with advanced validation and audit logging. 
          All operations are monitored for security and compliance.
        </AlertDescription>
      </Alert>

      {/* Token Balance Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                Token Balance
              </CardTitle>
              <CardDescription>
                Your current secure token balance
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshData}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary mb-4">
            {balance.toLocaleString()} Tokens
          </div>
          
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => handleAwardTokens(10, 'daily_bonus')}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Trophy className="w-4 h-4" />
              Daily Bonus (10)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAwardTokens(25, 'profile_completion')}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              Profile Bonus (25)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAwardTokens(5, 'gift_received')}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Gift className="w-4 h-4" />
              Gift Bonus (5)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            Your latest token transactions with security validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet. Start earning tokens!
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {transactions.map((transaction) => (
                <div 
                  key={transaction.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getTransactionIcon(transaction.reason, transaction.delta)}
                    <div>
                      <div className="font-medium">
                        {formatReason(transaction.reason)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleDateString()} at{' '}
                        {new Date(transaction.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={transaction.delta > 0 ? 'default' : 'destructive'}
                      className="mb-1"
                    >
                      {transaction.delta > 0 ? '+' : ''}{transaction.delta}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      Balance: {transaction.balance}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SecureTokenManager;