import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Search, 
  Trash2, 
  Users, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import AdminWithdrawals from '@/components/AdminWithdrawals';

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  email?: string;
  avatar_url: string | null;
  location: string;
  age: number;
  verified: boolean;
  created_at: string;
  onboarding_completed: boolean;
}

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  // Load users
  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget || deleteConfirmText !== 'DELETE') return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        'https://kdvnxzniqyomdeicmycs.supabase.co/functions/v1/delete-account',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ target_user_id: deleteTarget.user_id }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      toast({
        title: 'User Deleted',
        description: `${deleteTarget.display_name} has been permanently deleted`,
      });

      // Remove from local state
      setUsers(users.filter(u => u.user_id !== deleteTarget.user_id));
      setDeleteTarget(null);
      setDeleteConfirmText('');

    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <Shield className="w-12 h-12 mx-auto text-primary" />
          </div>
          <p className="text-muted-foreground">Checking admin access...</p>
        </div>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have admin privileges to access this page.
            </p>
            <Button onClick={() => navigate('/app')}>
              Return to App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card className="cultural-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Admin Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {users.length} Users
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={loadUsers}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No users match your search' : 'No users found'}
              </div>
            ) : (
              filteredUsers.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback>
                        {profile.display_name?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{profile.display_name}</span>
                        {profile.verified && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {!profile.onboarding_completed && (
                          <Badge variant="outline" className="text-xs">
                            Incomplete
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {profile.location} • {profile.age} years
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {profile.user_id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(profile)}
                      disabled={profile.user_id === user?.id}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal Management */}
      <AdminWithdrawals />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => {
        setDeleteTarget(null);
        setDeleteConfirmText('');
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete User Account
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  You are about to permanently delete the account for:
                </p>
                
                {deleteTarget && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Avatar>
                      <AvatarImage src={deleteTarget.avatar_url || undefined} />
                      <AvatarFallback>
                        {deleteTarget.display_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{deleteTarget.display_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {deleteTarget.user_id}
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
                  <strong>Warning:</strong> This action is irreversible. All user data including:
                  <ul className="list-disc ml-5 mt-2 space-y-1">
                    <li>Profile and photos</li>
                    <li>Messages and connections</li>
                    <li>Streaming history</li>
                    <li>Currency balances and purchases</li>
                    <li>All other associated data</li>
                  </ul>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Type <span className="font-mono bg-muted px-1">DELETE</span> to confirm:
                  </label>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="mt-2"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteConfirmText !== 'DELETE' || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
