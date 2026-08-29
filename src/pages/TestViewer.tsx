import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import StreamViewer from '@/components/StreamViewer';
import { TikTokStreamViewer } from '@/components/TikTokStreamViewer';

const mockUser = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'test@example.com',
  app_metadata: { provider: 'email' },
  email_confirmed_at: new Date().toISOString(),
} as any;

const mockSession = {
  user: mockUser,
  access_token: 'mock-token',
  refresh_token: 'mock-refresh',
  expires_at: Date.now() + 3600,
} as any;

// Patch supabase auth so AuthProvider sees a mock session without network calls
(supabase.auth as any).getSession = async () => ({ data: { session: mockSession }, error: null });
(supabase.auth as any).onAuthStateChange = () => ({
  data: { subscription: { unsubscribe: () => {} } },
});
(supabase.auth as any).getUser = async () => ({ data: { user: mockUser }, error: null });

const TestViewer: React.FC = () => {
  const [params] = useSearchParams();
  const mode = params.get('mode') || 'sv';

  return (
    <AuthProvider>
      {mode === 'tiktok' ? (
        <TikTokStreamViewer
          streamId="00000000-0000-0000-0000-000000000000"
          streamTitle="Test Stream"
          hostName="Test Host"
          hostUserId="00000000-0000-0000-0000-000000000001"
          hostAvatar=""
          currentViewers={5}
          totalLikes={12}
          onClose={() => console.log('close')}
        />
      ) : (
        <StreamViewer
          streamId="00000000-0000-0000-0000-000000000000"
          streamTitle="Test Stream"
          hostName="Test Host"
          hostUserId="00000000-0000-0000-0000-000000000001"
          onClose={() => console.log('close')}
        />
      )}
    </AuthProvider>
  );
};

export default TestViewer;
