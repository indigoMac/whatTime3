import * as React from "react";
import { useState } from "react";
import { 
  Button, 
  Card, 
  CardHeader, 
  CardPreview,
  Text,
  Body1,
  Caption1,
  makeStyles,
  Spinner
} from "@fluentui/react-components";
import { 
  PersonAccounts24Regular, 
  LockClosed24Regular,
  CheckmarkCircle24Regular 
} from "@fluentui/react-icons";
import { authService } from "../services/authService";

interface AuthenticationManagerProps {
  onAuthSuccess: () => void;
}

const useStyles = makeStyles({
  container: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
  },
  card: {
    maxWidth: "400px",
    width: "100%",
  },
  cardContent: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    alignItems: "center",
    textAlign: "center",
  },
  icon: {
    fontSize: "48px",
    color: "#0078d4",
  },
  errorCard: {
    border: "1px solid #ef4444",
  },
  successCard: {
    border: "1px solid #06b6d4",
  },
});

const AuthenticationManager: React.FC<AuthenticationManagerProps> = ({ onAuthSuccess }) => {
  const styles = useStyles();
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setError(null);
      
      const success = await authService.initialize();
      
      if (success) {
        setIsSuccess(true);
        setTimeout(() => {
          onAuthSuccess();
        }, 1000);
      } else {
        setError("Authentication failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Sign-in failed:", error);
      setError(error.message || "Sign-in failed. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={styles.container}>
        <Card className={`${styles.card} ${styles.successCard}`}>
          <CardHeader
            image={<CheckmarkCircle24Regular className={styles.icon} />}
            header={<Text weight="semibold">Authentication Successful!</Text>}
            description={<Caption1>Loading Meeting Optimizer...</Caption1>}
          />
          <div className={styles.cardContent}>
            <Spinner size="medium" />
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Card className={`${styles.card} ${styles.errorCard}`}>
          <CardHeader
            image={<LockClosed24Regular className={styles.icon} />}
            header={<Text weight="semibold">Authentication Error</Text>}
            description={<Caption1>{error}</Caption1>}
          />
          <div className={styles.cardContent}>
            <Button 
              appearance="primary" 
              onClick={handleSignIn}
              disabled={isSigningIn}
            >
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardPreview>
          <div style={{ padding: "40px", textAlign: "center" }}>
            <PersonAccounts24Regular className={styles.icon} />
          </div>
        </CardPreview>
        <CardHeader
          header={<Text weight="semibold">Sign in to Microsoft 365</Text>}
          description={
            <Caption1>
              Connect your Microsoft 365 account to access calendar data and optimize your meetings.
            </Caption1>
          }
        />
        <div className={styles.cardContent}>
          <Body1>
            Meeting Optimizer needs to access your calendar to:
          </Body1>
          <ul style={{ textAlign: "left", margin: 0, paddingLeft: "20px" }}>
            <li>View your availability</li>
            <li>Analyze meeting conflicts</li>
            <li>Suggest optimal meeting times</li>
            <li>Create meeting invitations</li>
          </ul>
          <Button 
            appearance="primary" 
            size="large"
            onClick={handleSignIn}
            disabled={isSigningIn}
            icon={isSigningIn ? <Spinner size="tiny" /> : undefined}
          >
            {isSigningIn ? "Signing In..." : "Sign In with Microsoft 365"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AuthenticationManager; 