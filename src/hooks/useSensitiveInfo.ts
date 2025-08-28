import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

interface SensitiveInfo {
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  last_accessed_at?: string;
}

export const useSensitiveInfo = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sensitiveInfo, setSensitiveInfo] = useState<SensitiveInfo>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSensitiveInfo = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('get_user_sensitive_info');
      
      if (error) {
        console.error('Error loading sensitive info:', error);
        setError('Failed to load sensitive information');
        return;
      }
      
      setSensitiveInfo(data as SensitiveInfo || {});
    } catch (err) {
      console.error('Error loading sensitive info:', err);
      setError('Failed to load sensitive information');
    } finally {
      setLoading(false);
    }
  };

  const updateSensitiveInfo = async (updates: {
    phone?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
  }) => {
    if (!user) return false;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('update_user_sensitive_info', {
        new_phone: updates.phone,
        new_emergency_contact_name: updates.emergency_contact_name,
        new_emergency_contact_phone: updates.emergency_contact_phone
      });
      
      if (error) {
        console.error('Error updating sensitive info:', error);
        setError('Failed to update sensitive information');
        toast({
          title: "Error",
          description: "Failed to update sensitive information. Please try again.",
          variant: "destructive"
        });
        return false;
      }
      
      // Reload the sensitive info after update
      await loadSensitiveInfo();
      
      toast({
        title: "Success",
        description: "Sensitive information updated securely.",
      });
      
      return true;
    } catch (err) {
      console.error('Error updating sensitive info:', err);
      setError('Failed to update sensitive information');
      toast({
        title: "Error",
        description: "Failed to update sensitive information. Please try again.",
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSensitiveInfo();
    }
  }, [user]);

  return {
    sensitiveInfo,
    loading,
    error,
    loadSensitiveInfo,
    updateSensitiveInfo
  };
};