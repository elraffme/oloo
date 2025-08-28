import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Eye, Calendar, AlertTriangle, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface SecurityEvent {
  id: string;
  action: string;
  resource_type: string | null;
  created_at: string;
  details: any;
  success: boolean | null;
  ip_address: string | null;
}

const SecurityAuditViewer = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSecurityEvents = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('security_audit_log')
        .select('id, action, resource_type, created_at, details, success, ip_address')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        throw fetchError;
      }

      setEvents((data || []).map(event => ({
        ...event,
        ip_address: event.ip_address as string | null
      })));
    } catch (err: any) {
      console.error('Error fetching security events:', err);
      setError(err.message || 'Failed to load security events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityEvents();
  }, [user]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
      case 'logout':
        return <Shield className="w-4 h-4" />;
      case 'profile_view':
      case 'profile_update':
        return <Eye className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string, success: boolean | null = true) => {
    if (success === false) return 'destructive';
    
    switch (action) {
      case 'login':
        return 'default';
      case 'logout':
        return 'secondary';
      case 'profile_update':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatEventDetails = (details: any) => {
    if (!details || typeof details !== 'object') return null;
    
    return Object.entries(details)
      .filter(([key]) => !key.startsWith('_') && key !== 'timestamp')
      .map(([key, value]) => (
        <div key={key} className="text-xs text-muted-foreground">
          <span className="font-medium">{key}:</span> {String(value)}
        </div>
      ));
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Please sign in to view security events</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security Activity
            </CardTitle>
            <CardDescription>
              View your recent security events and account activity
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSecurityEvents}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No security events found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={event.id}>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getActionIcon(event.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getActionColor(event.action, event.success)}>
                        {event.action.replace('_', ' ')}
                      </Badge>
                      {event.resource_type && (
                        <Badge variant="outline" className="text-xs">
                          {event.resource_type}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {format(new Date(event.created_at), 'MMM dd, yyyy at HH:mm:ss')}
                      {event.ip_address && (
                        <span className="ml-2">from {event.ip_address}</span>
                      )}
                    </div>
                    {event.details && formatEventDetails(event.details)}
                  </div>
                </div>
                {index < events.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            <p className="mb-1">
              <strong>Security Notice:</strong> These logs are automatically generated and cannot be modified.
            </p>
            <p>
              If you notice any suspicious activity, please contact support immediately.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecurityAuditViewer;