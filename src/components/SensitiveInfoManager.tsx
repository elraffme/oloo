import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Shield, Phone, User, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSensitiveInfo } from '@/hooks/useSensitiveInfo';

export const SensitiveInfoManager: React.FC = () => {
  const { sensitiveInfo, loading, updateSensitiveInfo } = useSensitiveInfo();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  const handleEdit = () => {
    setFormData({
      phone: sensitiveInfo.phone || '',
      emergency_contact_name: sensitiveInfo.emergency_contact_name || '',
      emergency_contact_phone: sensitiveInfo.emergency_contact_phone || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    const success = await updateSensitiveInfo(formData);
    if (success) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      phone: '',
      emergency_contact_name: '',
      emergency_contact_phone: ''
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-500" />
          Secure Contact Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This information is encrypted and stored separately from your public profile for enhanced security. 
            All access is logged and monitored.
          </AlertDescription>
        </Alert>

        {!isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </Label>
                <div className="p-3 bg-muted rounded-lg">
                  {sensitiveInfo.phone ? (
                    <span className="font-mono">{sensitiveInfo.phone}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Emergency Contact Name
                </Label>
                <div className="p-3 bg-muted rounded-lg">
                  {sensitiveInfo.emergency_contact_name ? (
                    <span>{sensitiveInfo.emergency_contact_name}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Emergency Contact Phone
                </Label>
                <div className="p-3 bg-muted rounded-lg">
                  {sensitiveInfo.emergency_contact_phone ? (
                    <span className="font-mono">{sensitiveInfo.emergency_contact_phone}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </div>
              </div>
            </div>

            {sensitiveInfo.last_accessed_at && (
              <div className="text-xs text-muted-foreground">
                Last accessed: {new Date(sensitiveInfo.last_accessed_at).toLocaleString()}
              </div>
            )}

            <Button onClick={handleEdit} variant="outline" className="w-full">
              Edit Secure Information
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergency_name">Emergency Contact Name</Label>
                <Input
                  id="emergency_name"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergency_phone">Emergency Contact Phone</Label>
                <Input
                  id="emergency_phone"
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                  placeholder="+1 (555) 987-6543"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button onClick={handleCancel} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};