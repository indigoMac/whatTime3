import * as React from "react";
import { useState, useEffect } from "react";
import { 
  Card, 
  CardHeader,
  Text,
  Caption1,
  Button,
  Spinner,
  Tab,
  TabList,
  makeStyles
} from "@fluentui/react-components";
import { 
  Calendar24Regular, 
  CalendarLtr24Regular,
  List24Regular
} from "@fluentui/react-icons";
import { authService } from "../services/authService";
import { Attendee, getAttendeeEmail } from "./attendees";
import { AvailabilityResponse } from "../types/availability";
import AvailabilityList from "./AvailabilityList";
import AvailabilityCalendar from "./AvailabilityCalendar";

interface AvailabilityManagerProps {
  attendees: Attendee[];
  duration: number;
  onSlotSelect?: (slot: any) => void;
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  tabContainer: {
    padding: "16px",
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

type ViewMode = 'list' | 'calendar';

const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({
  attendees,
  duration,
  onSlotSelect
}) => {
  const styles = useStyles();
  const [availabilityData, setAvailabilityData] = useState<AvailabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);

  useEffect(() => {
    if (attendees.length > 0) {
      fetchAvailability();
    }
  }, [attendees, duration]);

  const fetchAvailability = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const attendeeEmails = attendees.map(getAttendeeEmail);
      const data = await authService.getDetailedAvailability(
        attendeeEmails,
        duration
      );
      
      setAvailabilityData(data);
    } catch (error: any) {
      console.error("Failed to fetch availability:", error);
      setError(error.message || "Failed to fetch availability data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSlotSelect = (slot: any) => {
    setSelectedSlot(slot);
    onSlotSelect?.(slot);
  };

  if (attendees.length === 0) {
    return null;
  }

  return (
    <Card className={styles.container}>
      <CardHeader
        image={<Calendar24Regular />}
        header={<Text weight="semibold">Available Times</Text>}
        description={
          <Caption1>
            Showing availability for {attendees.length} attendee{attendees.length > 1 ? 's' : ''}
          </Caption1>
        }
        action={
          <Button
            appearance="outline"
            size="small"
            onClick={fetchAvailability}
            disabled={isLoading}
          >
            Refresh
          </Button>
        }
      />

      <div className={styles.tabContainer}>
        <TabList selectedValue={viewMode} onTabSelect={(_, data) => setViewMode(data.value as ViewMode)}>
          <Tab value="list" icon={<List24Regular />}>
            List View
          </Tab>
          <Tab value="calendar" icon={<CalendarLtr24Regular />}>
            Calendar View
          </Tab>
        </TabList>

        {isLoading && (
          <div className={styles.loadingContainer}>
            <Spinner size="large" />
            <Text weight="semibold">Analyzing availability...</Text>
            <Caption1>Checking {attendees.length} calendar{attendees.length > 1 ? 's' : ''}</Caption1>
          </div>
        )}

        {error && (
          <div className={styles.errorContainer}>
            <Text>{error}</Text>
          </div>
        )}

        {availabilityData && !isLoading && (
          <>
            {viewMode === 'list' && (
              <AvailabilityList
                availabilityData={availabilityData}
                onSlotSelect={handleSlotSelect}
                selectedSlot={selectedSlot}
              />
            )}
            {viewMode === 'calendar' && (
              <AvailabilityCalendar
                availabilityData={availabilityData}
                onSlotSelect={handleSlotSelect}
                selectedSlot={selectedSlot}
              />
            )}
          </>
        )}
      </div>
    </Card>
  );
};

export default AvailabilityManager; 