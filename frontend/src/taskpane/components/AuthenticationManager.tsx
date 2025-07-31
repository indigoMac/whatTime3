import React, { useState } from "react";
import { LogIn, Shield, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { authService } from "../services/authService";

interface AuthenticationManagerProps {
  onAuthSuccess: () => void;
}

const AuthenticationManager: React.FC<AuthenticationManagerProps> = ({ onAuthSuccess }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      
      const success = await authService.initialize();
      if (success) {
        onAuthSuccess();
      } else {
        setAuthError('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthError('Authentication failed. Please check your connection and try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <Shield className="h-12 w-12 text-primary" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Sign in to continue</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
                          What Time requires access to your Microsoft 365 account to check calendars and optimize meeting times.
          </p>
        </div>
      </div>

      {authError && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md max-w-sm">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div className="text-sm text-destructive">{authError}</div>
        </div>
      )}

      <div className="space-y-4 w-full max-w-sm">
        <Button 
          onClick={handleSignIn} 
          disabled={isAuthenticating}
          className="w-full"
          size="lg"
        >
          {isAuthenticating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Signing in...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 mr-2" />
              Sign in with Microsoft
            </>
          )}
        </Button>
        
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>We use enterprise-grade security to protect your data.</p>
          <p>Your calendar details remain private and secure.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthenticationManager; 