import * as React from "react";
import { useState, useEffect } from "react";
import Header from "./Header";
import MeetingOptimizer from "./MeetingOptimizer";
import AuthenticationManager from "./AuthenticationManager";
import { makeStyles } from "@fluentui/react-components";
import { authService } from "../services/authService";

interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
});

interface UserProfile {
  displayName: string;
  mail: string;
  id: string;
}

const App: React.FC<AppProps> = (props: AppProps) => {
  const styles = useStyles();
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
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to get user profile:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.root}>
        <Header logo="assets/logo-filled.png" title={props.title} message="Loading..." />
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Initializing Meeting Optimizer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Header 
        logo="assets/logo-filled.png" 
        title={props.title} 
        message={userProfile ? `Welcome, ${userProfile.displayName}` : "Welcome"} 
      />
      
      {!isAuthenticated ? (
        <AuthenticationManager onAuthSuccess={handleAuthSuccess} />
      ) : (
        <MeetingOptimizer userProfile={userProfile} />
      )}
    </div>
  );
};

export default App;
