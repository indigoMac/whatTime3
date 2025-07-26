import * as React from "react";
import { useState } from "react";
import {
  Input,
  Button,
  Text,
  Caption1,
  makeStyles,
  tokens
} from "@fluentui/react-components";
import {
  Mail24Regular,
  Add24Regular,
  ErrorCircle24Regular
} from "@fluentui/react-icons";
import { ExternalAttendeeInputProps, createExternalAttendee } from "../../types/attendee";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  inputContainer: {
    display: "flex",
    gap: "8px",
    alignItems: "end"
  },
  errorMessage: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: tokens.colorPaletteRedForeground1,
    marginTop: "4px"
  },
  hint: {
    color: tokens.colorNeutralForeground3,
    marginTop: "4px"
  }
});

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ExternalAttendeeInput: React.FC<ExternalAttendeeInputProps> = ({
  onAttendeeAdd,
  excludeEmails = [],
  placeholder = "Enter external email address"
}) => {
  const styles = useStyles();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (emailValue: string): string | null => {
    if (!emailValue.trim()) {
      return "Email address is required";
    }

    if (!EMAIL_REGEX.test(emailValue)) {
      return "Please enter a valid email address";
    }

    if (excludeEmails.includes(emailValue.toLowerCase())) {
      return "This attendee is already added";
    }

    return null;
  };

  const handleAddAttendee = () => {
    const trimmedEmail = email.trim().toLowerCase();
    const validationError = validateEmail(trimmedEmail);

    if (validationError) {
      setError(validationError);
      return;
    }

    // Extract display name from email if possible
    const displayName = trimmedEmail.split('@')[0];
    
    const externalAttendee = createExternalAttendee(trimmedEmail, displayName);
    onAttendeeAdd(externalAttendee);
    
    // Reset form
    setEmail("");
    setError(null);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAttendee();
    }
  };

  const isValid = email.trim() && !validateEmail(email.trim());

  return (
    <div className={styles.container}>
      <div className={styles.inputContainer}>
        <Input
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          contentBefore={<Mail24Regular />}
          style={{ flex: 1 }}
          type="email"
          appearance={error ? "filled-darker" : "outline"}
        />
        <Button
          appearance="primary"
          icon={<Add24Regular />}
          onClick={handleAddAttendee}
          disabled={!isValid}
        >
          Add
        </Button>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <ErrorCircle24Regular />
          <Text size={200}>{error}</Text>
        </div>
      )}

      <div className={styles.hint}>
        <Caption1>
          Add external attendees who are not part of your organization
        </Caption1>
      </div>
    </div>
  );
};

export default ExternalAttendeeInput; 