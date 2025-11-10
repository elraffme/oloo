import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VideoCall from '@/components/VideoCall';
import { IncomingCallModal } from '@/components/IncomingCallModal';

const VideoCallPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as any;

  useEffect(() => {
    // Redirect if no call data
    if (!state?.callId) {
      navigate('/messages');
    }
  }, [state, navigate]);

  const handleCallEnd = () => {
    navigate('/messages');
  };

  if (!state?.callId) {
    return null;
  }

  return (
    <>
      <IncomingCallModal />
      <VideoCall
        callId={state.callId}
        isInitiator={state.isInitiator}
        onCallEnd={handleCallEnd}
        participantName={state.participantName}
        participantId={state.participantId}
        callType={state.callType}
      />
    </>
  );
};

export default VideoCallPage;
