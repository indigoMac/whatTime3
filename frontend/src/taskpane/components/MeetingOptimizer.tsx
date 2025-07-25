import * as React from "react";
import { useState, useEffect } from "react";
import { 
  Button, 
  Card, 
  CardHeader,
  Input,
  Label,
  Text,
  Body1,
  Caption1,
  Textarea,
  makeStyles,
  Spinner,
  Badge,
  Divider
} from "@fluentui/react-components";
import { 
  Calendar24Regular, 
  People24Regular,
  Clock24Regular,
  Add24Regular,
  Delete24Regular,
  CheckmarkCircle24Regular
} from "@fluentui/react-icons";
import { authService } from "../services/authService";

interface MeetingOptimizerProps {
  userProfile: any;
}

const useStyles = makeStyles({
  container: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    flex: 1,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  attendeeInput: {
    display: "flex",
    gap: "8px",
    alignItems: "end",
  },
  attendeeList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  attendeeItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    border: "1px solid #e1e1e1",
    borderRadius: "4px",
    backgroundColor: "#f9f9f9",
  },
  suggestionCard: {
    marginBottom: "12px",
  },
  suggestionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    padding: "40px",
  },
  errorContainer: {
    padding: "16px",
    backgroundColor: "#fef2f2",
    border: "1px solid #ef4444",
    borderRadius: "4px",
    color: "#dc2626",
  },
});

interface MeetingSuggestion {
  startTime: string;
  endTime: string;
  score: number;
  reason: string;
}

interface OptimizationResult {
  optimizedSuggestions: MeetingSuggestion[];
  attendees: string[];
  duration: number;
}

const MeetingOptimizer: React.FC<MeetingOptimizerProps> = ({ userProfile: _ }) => {
  const styles = useStyles();
  const [attendees, setAttendees] = useState<string[]>([]);
  const [newAttendee, setNewAttendee] = useState("");
  const [duration, setDuration] = useState("60");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addAttendee = () => {
    if (newAttendee.trim() && !attendees.includes(newAttendee.trim())) {
      setAttendees([...attendees, newAttendee.trim()]);
      setNewAttendee("");
    }
  };

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter(a => a !== email));
  };

  const handleOptimizeMeeting = async () => {
    if (attendees.length === 0) {
      setError("Please add at least one attendee.");
      return;
    }

    try {
      setIsOptimizing(true);
      setError(null);
      
      const result = await authService.optimizeMeeting(
        attendees, 
        parseInt(duration) || 60
      );
      
      setOptimizationResult(result);
    } catch (error: any) {
      console.error("Meeting optimization failed:", error);
      setError(error.message || "Failed to optimize meeting. Please try again.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const formatDateTime = (dateTimeString: string): string => {
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return "#10b981"; // green
    if (score >= 75) return "#f59e0b"; // yellow
    return "#ef4444"; // red
  };

  if (isOptimizing) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spinner size="large" />
          <Text weight="semibold">Optimizing your meeting...</Text>
          <Caption1>Analyzing calendars and finding the best times</Caption1>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Meeting Setup Section */}
      <Card>
        <CardHeader
          image={<People24Regular />}
          header={<Text weight="semibold">Meeting Setup</Text>}
          description={<Caption1>Add attendees and configure your meeting</Caption1>}
        />
        
        <div style={{ padding: "20px" }}>
          <div className={styles.section}>
            <Label htmlFor="attendee-input" weight="semibold">
              Add Attendees
            </Label>
            <div className={styles.attendeeInput}>
              <Input
                id="attendee-input"
                placeholder="Enter email address"
                value={newAttendee}
                onChange={(e) => setNewAttendee(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addAttendee()}
                style={{ flex: 1 }}
              />
              <Button 
                appearance="primary" 
                icon={<Add24Regular />}
                onClick={addAttendee}
                disabled={!newAttendee.trim()}
              >
                Add
              </Button>
            </div>
            
            {attendees.length > 0 && (
              <div className={styles.attendeeList}>
                <Text weight="semibold">Attendees ({attendees.length})</Text>
                {attendees.map((email, index) => (
                  <div key={index} className={styles.attendeeItem}>
                    <Text>{email}</Text>
                    <Button
                      appearance="subtle"
                      icon={<Delete24Regular />}
                      onClick={() => removeAttendee(email)}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Divider style={{ margin: "20px 0" }} />

          <div className={styles.section}>
            <Label htmlFor="duration-input" weight="semibold">
              Meeting Duration (minutes)
            </Label>
            <Input
              id="duration-input"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              style={{ maxWidth: "120px" }}
            />
          </div>

          {error && (
            <div className={styles.errorContainer}>
              <Text>{error}</Text>
            </div>
          )}

          <Button 
            appearance="primary" 
            size="large"
            icon={<Calendar24Regular />}
            onClick={handleOptimizeMeeting}
            disabled={attendees.length === 0 || isOptimizing}
            style={{ marginTop: "16px" }}
          >
            Optimize Meeting Times
          </Button>
        </div>
      </Card>

      {/* Optimization Results */}
      {optimizationResult && (
        <Card>
          <CardHeader
            image={<CheckmarkCircle24Regular />}
            header={<Text weight="semibold">Optimization Results</Text>}
            description={
              <Caption1>
                Found {optimizationResult.optimizedSuggestions.length} optimal time suggestions
              </Caption1>
            }
          />
          
          <div style={{ padding: "20px" }}>
            {optimizationResult.optimizedSuggestions.map((suggestion, index) => (
              <Card key={index} className={styles.suggestionCard}>
                <div style={{ padding: "16px" }}>
                  <div className={styles.suggestionHeader}>
                    <div>
                      <Text weight="semibold">
                        {formatDateTime(suggestion.startTime)}
                      </Text>
                      <Caption1 style={{ display: "block" }}>
                        {duration} minutes
                      </Caption1>
                    </div>
                    <Badge 
                      color="important"
                      style={{ 
                        backgroundColor: getScoreColor(suggestion.score),
                        color: "white"
                      }}
                    >
                      {suggestion.score}% match
                    </Badge>
                  </div>
                  <Body1 style={{ marginTop: "8px" }}>
                    {suggestion.reason}
                  </Body1>
                  <Button 
                    appearance="primary"
                    style={{ marginTop: "12px" }}
                    onClick={() => {
                      // TODO: Implement meeting creation
                      alert("Meeting creation will be implemented in the next phase!");
                    }}
                  >
                    Create Meeting
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default MeetingOptimizer; 