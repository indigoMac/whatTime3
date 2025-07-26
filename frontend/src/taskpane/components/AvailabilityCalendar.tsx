import * as React from "react";
import { 
  Card,
  Text,
  Caption1,
  makeStyles
} from "@fluentui/react-components";
import { CalendarViewProps } from "../types/availability";

const useStyles = makeStyles({
  container: {
    marginTop: "16px",
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "1px",
    backgroundColor: "#e5e5e5",
    border: "1px solid #e5e5e5",
  },
  dayHeader: {
    padding: "8px",
    backgroundColor: "#f5f5f5",
    textAlign: "center",
    fontWeight: "600",
    fontSize: "12px",
  },
  timeSlot: {
    padding: "4px",
    minHeight: "40px",
    backgroundColor: "white",
    cursor: "pointer",
    border: "1px solid transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    "&:hover": {
      backgroundColor: "#f0f8ff",
    },
  },
  availableSlot: {
    backgroundColor: "#e6ffe6",
    "&:hover": {
      backgroundColor: "#ccffcc",
    },
  },
  partialSlot: {
    backgroundColor: "#fff2cc",
    "&:hover": {
      backgroundColor: "#ffe699",
    },
  },
  busySlot: {
    backgroundColor: "#ffe6e6",
    cursor: "not-allowed",
  },
  selectedSlot: {
    border: "2px solid #0078d4",
    backgroundColor: "#f3f9ff",
  },
  legend: {
    display: "flex",
    gap: "16px",
    marginTop: "12px",
    padding: "8px",
    fontSize: "12px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  legendColor: {
    width: "12px",
    height: "12px",
    borderRadius: "2px",
  },
});

const AvailabilityCalendar: React.FC<CalendarViewProps> = ({
  availabilityData,
  selectedSlot,
  onSlotSelect
}) => {
  const styles = useStyles();

  // For now, show a simplified weekly view
  // This would be expanded to show actual calendar grid
  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className={styles.container}>
      <Card>
        <div style={{ padding: "16px" }}>
          <Text weight="semibold" style={{ marginBottom: "16px" }}>
            Weekly Calendar View
          </Text>
          
          {/* Simplified calendar grid - you would expand this */}
          <div className={styles.calendarGrid}>
            {dayHeaders.map(day => (
              <div key={day} className={styles.dayHeader}>
                {day}
              </div>
            ))}
            
            {/* Show available slots in grid format */}
            {availabilityData.suggestedSlots.slice(0, 14).map((slot, index) => (
              <div
                key={index}
                className={`${styles.timeSlot} ${
                  slot.isAvailable ? styles.availableSlot : 
                  slot.conflictCount > 0 ? styles.partialSlot : styles.busySlot
                } ${selectedSlot === slot ? styles.selectedSlot : ''}`}
                onClick={() => slot.isAvailable && onSlotSelect(slot)}
              >
                {new Date(slot.start).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            ))}
          </div>

          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor}`} style={{ backgroundColor: "#e6ffe6" }} />
              <Caption1>Available</Caption1>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor}`} style={{ backgroundColor: "#fff2cc" }} />
              <Caption1>Partial Availability</Caption1>
            </div>
            <div className={styles.legendItem}>
              <div className={`${styles.legendColor}`} style={{ backgroundColor: "#ffe6e6" }} />
              <Caption1>Busy</Caption1>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AvailabilityCalendar; 