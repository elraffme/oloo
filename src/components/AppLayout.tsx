import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { Heart, Video, MessageCircle, User, Settings, LogOut, Search, Zap, Shield, Crown } from 'lucide-react';
const AppLayout = () => {
  const {
    user,
    signOut,
    loading
  } = useAuth();
  const location = useLocation();

  // Enable global real-time notifications
  useRealtimeNotifications();

  // Redirect to auth if not logged in
  if (!user && !loading) {
    return <Navigate to="/auth" replace />;
  }
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="animate-pulse text-center">
          <div className="heart-logo mx-auto mb-4">
            <span className="logo-text">Ò</span>
          </div>
          <p className="text-muted-foreground">Loading your Òloo experience...</p>
        </div>
      </div>;
  }
  const navItems = [{
    path: '/app',
    icon: Heart,
    label: 'Discover',
    end: true
  }, {
    path: '/app/streaming',
    icon: Video,
    label: 'Stream'
  }, {
    path: '/app/messages',
    icon: MessageCircle,
    label: 'Messages'
  }, {
    path: '/app/profile',
    icon: User,
    label: 'Profile'
  }];
  const handleSignOut = async () => {
    await signOut();
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      {/* Top Navigation */}
      <header className="bg-background border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            

            {/* Center Navigation - All Screens */}
            <nav className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
              {navItems.map(item => {
              const isActive = item.end ? location.pathname === item.path : location.pathname.startsWith(item.path);
              return <NavLink key={item.path} to={item.path}>
                    <Button 
                      variant="default" 
                      size="default" 
                      className="flex items-center space-x-2 bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap shadow-md hover:shadow-lg transition-shadow"
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="hidden sm:inline font-medium">{item.label}</span>
                    </Button>
                  </NavLink>;
            })}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center space-x-2">
              {/* Quick Actions */}
              <Button variant="outline" size="default" className="flex bg-white shadow-sm hover:shadow-md transition-shadow">
                <Search className="w-5 h-5" />
              </Button>
              
              <Button variant="outline" size="default" className="relative bg-white shadow-sm hover:shadow-md transition-shadow">
                <Zap className="w-5 h-5 text-accent" />
                <Badge variant="secondary" className="absolute -top-2 -right-2 h-6 w-6 text-xs p-0 flex items-center justify-center font-bold shadow-md">
                  0
                </Badge>
              </Button>

              <Button variant="outline" size="default" onClick={handleSignOut} className="bg-white shadow-sm hover:shadow-md transition-shadow">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-2 pt-16 md:pt-2 max-h-[calc(100vh-4rem)] overflow-auto">
        <Outlet />
      </main>


    </div>;
};
export default AppLayout;