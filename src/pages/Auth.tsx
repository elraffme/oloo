import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Auth = () => {
  const { user, loading } = useAuth();

  // Redirect if already authenticated
  if (user && !loading) {
    return <Navigate to="/app" replace />;
  }

  // Redirect to onboarding for account creation
  if (!user && !loading) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <div className="animate-pulse">
        <div className="heart-logo mx-auto mb-4">
          <span className="logo-text">Ò</span>
        </div>
        <p className="text-muted-foreground text-center">Loading Òloo...</p>
      </div>
    </div>
  );
};

export default Auth;