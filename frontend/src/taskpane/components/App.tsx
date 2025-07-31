import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { MeetingOptimizerSidebar } from "./MeetingOptimizerSidebar";
import AuthenticationManager from "./AuthenticationManager";
import { authService } from "../services/authService";

interface AppProps {
  title: string;
}

interface UserProfile {
  displayName: string;
  mail: string;
  id: string;
}

const App: React.FC<AppProps> = (props: AppProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      const isAuth = await authService.initialize();
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        const profile = await authService.getUserProfile();
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Authentication initialization failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = async () => {
    setIsAuthenticated(true);
    try {
      const profile = await authService.getUserProfile();
      console.log(profile);
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to get user profile:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">{props.title}</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Initializing Meeting Optimizer...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">{props.title}</h1>
          </div>
        </div>
        <div className="flex-1">
          <AuthenticationManager onAuthSuccess={handleAuthSuccess} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground">
      <MeetingOptimizerSidebar userProfile={userProfile} />
    </div>
  );
};

export default App;
