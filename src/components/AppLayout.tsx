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
      <header className="bg-background/95 backdrop-blur-sm border-b border-border/20 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              
              <div>
                <h1 className="text-xl font-bold font-afro-heading text-primary">Òloo</h1>
                <p className="text-xs text-muted-foreground">Cultured connections</p>
              </div>
            </div>

            {/* Center Navigation - Desktop */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map(item => {
              const isActive = item.end ? location.pathname === item.path : location.pathname.startsWith(item.path);
              return <NavLink key={item.path} to={item.path}>
                    <Button variant="default" size="sm" className="flex items-center space-x-2 bg-primary text-primary-foreground hover:bg-primary/90">
                      <item.icon className="w-4 h-4" fill="currentColor" />
                      <span>{item.label}</span>
                    </Button>
                  </NavLink>;
            })}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center space-x-2">
              {/* Quick Actions */}
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                <Search className="w-4 h-4" />
              </Button>
              
              <Button variant="ghost" size="sm" className="relative">
                <Zap className="w-4 h-4 text-accent" />
                <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 w-5 text-xs p-0 flex items-center justify-center">
                  0
                </Badge>
              </Button>

              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border">
        <div className="grid grid-cols-4 h-16">
          {navItems.map(item => {
          const isActive = item.end ? location.pathname === item.path : location.pathname.startsWith(item.path);
          return <NavLink key={item.path} to={item.path} className="flex flex-col items-center justify-center space-y-1">
                <item.icon className="w-5 h-5 text-primary" fill="currentColor" />
                <span className="text-xs text-white font-medium">
                  {item.label}
                </span>
              </NavLink>;
        })}
        </div>
      </nav>

    </div>;
};
export default AppLayout;