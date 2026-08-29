import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import StreamViewer from '@/components/StreamViewer';
import { TikTokStreamViewer } from '@/components/TikTokStreamViewer';

const mockUser = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'test@example.com',
} as any;

const mockValue = {
  user: mockUser,
  session: null as any,
  loading: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signInWithTwitter: async () => ({ error: null }),
  signInWithFacebook: async () => ({ error: null }),
  signInWithLinkedIn: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
  requestPasswordReset: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
};

const TestViewer: React.FC = () => {
  const [params] = useSearchParams();
  const mode = params.get('mode') || 'sv';

  return (
    <AuthContext.Provider value={mockValue as any}>
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
    </AuthContext.Provider>
  );
};

export default TestViewer;
