import * as React from "react";
import { 
  Card,
  Text,
  Body1,
  Caption1,
  Badge,
  Button,
  makeStyles
} from "@fluentui/react-components";
import { 
  People24Regular,
  Clock24Regular,
  CheckmarkCircle24Regular
} from "@fluentui/react-icons";
import { AvailabilityListProps } from "../types/availability";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "16px",
  },
  slotCard: {
    cursor: "pointer",
    transition: "all 0.2s ease",
    "&:hover": {
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    },
  },
  selectedSlot: {
    border: "2px solid #0078d4",
    backgroundColor: "#f3f9ff",
  },
  slotHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  slotDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  attendeeInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px",
    color: "#666",
  },
});

const AvailabilityList: React.FC<AvailabilityListProps> = ({
  availabilityData,
  onSlotSelect,
  selectedSlot
}) => {
  const styles = useStyles();

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

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 90) return "#10b981"; // green
    if (confidence >= 70) return "#f59e0b"; // yellow
    return "#ef4444"; // red
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 90) return "Excellent";
    if (confidence >= 70) return "Good";
    return "Fair";
  };

  if (!availabilityData.suggestedSlots.length) {
    return (
      <div className={styles.emptyState}>
        <Clock24Regular style={{ fontSize: "48px", marginBottom: "16px" }} />
        <Text weight="semibold">No available times found</Text>
        <Caption1>Try adjusting the duration or selecting fewer attendees</Caption1>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {availabilityData.suggestedSlots.map((slot, index) => (
        <Card 
          key={index}
          className={`${styles.slotCard} ${
            selectedSlot === slot ? styles.selectedSlot : ''
          }`}
          onClick={() => onSlotSelect(slot)}
        >
          <div style={{ padding: "16px" }}>
            <div className={styles.slotHeader}>
              <div>
                <Text weight="semibold">
                  {formatDateTime(slot.start)}
                </Text>
                <Caption1 style={{ display: "block" }}>
                  {Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000)} minutes
                </Caption1>
              </div>
              <Badge 
                color="important"
                style={{ 
                  backgroundColor: getConfidenceColor(slot.confidence),
                  color: "white"
                }}
              >
                {getConfidenceLabel(slot.confidence)}
              </Badge>
            </div>

            <div className={styles.slotDetails}>
              <div className={styles.attendeeInfo}>
                <People24Regular style={{ fontSize: "16px" }} />
                <Body1>
                  {slot.attendeesAvailable.length} available, {slot.conflictCount} conflicts
                </Body1>
              </div>

              {slot.conflictCount > 0 && (
                <Caption1 style={{ color: "#ef4444" }}>
                  Conflicts: {slot.attendeesConflict.join(", ")}
                </Caption1>
              )}

              <Button 
                appearance={selectedSlot === slot ? "primary" : "outline"}
                size="small"
                icon={selectedSlot === slot ? <CheckmarkCircle24Regular /> : undefined}
                style={{ alignSelf: "flex-start", marginTop: "8px" }}
              >
                {selectedSlot === slot ? "Selected" : "Select Time"}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default AvailabilityList; 