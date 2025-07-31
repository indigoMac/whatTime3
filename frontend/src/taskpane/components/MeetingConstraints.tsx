import * as React from "react";
import { useState, useCallback } from "react";
import { 
  Card, 
  CardHeader,
  Text,
  Caption1,
  Input,
  Label,
  Button,
  makeStyles
} from "@fluentui/react-components";
import { 
  Calendar24Regular, 
  Clock24Regular,
  Add24Regular,
  Delete24Regular
} from "@fluentui/react-icons";

interface TimeOption {
  id: string;
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

interface PreferredTimeWindow {
  id: string;
  label: string;
  startHour: number;
  endHour: number;
  enabled: boolean;
}

interface MeetingConstraints {
  dateRange: {
    start: string;
    end: string;
  };
  preferredTimes: PreferredTimeWindow[];
  specificTimeOptions: TimeOption[];
  onlyBusinessHours: boolean;
}

interface MeetingConstraintsProps {
  onConstraintsChange: (constraints: MeetingConstraints) => void;
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  timeOption: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px",
    border: "1px solid #e5e5e5",
    borderRadius: "4px",
    backgroundColor: "#fafafa",
  },
  timeInputs: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  dateInputs: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  preferredTimeRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px",
    border: "1px solid #e5e5e5",
    borderRadius: "4px",
  },
});

const MeetingConstraints: React.FC<MeetingConstraintsProps> = ({ onConstraintsChange }) => {
  const styles = useStyles();
  
  // Initialize with sensible defaults
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0], // Today
    end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 2 weeks from now
  });
  
  const [preferredTimes] = useState<PreferredTimeWindow[]>([
    { id: '1', label: 'Morning (9 AM - 12 PM)', startHour: 9, endHour: 12, enabled: true },
    { id: '2', label: 'Afternoon (1 PM - 5 PM)', startHour: 13, endHour: 17, enabled: true },
    { id: '3', label: 'Early Morning (8 AM - 10 AM)', startHour: 8, endHour: 10, enabled: false },
  ]);
  
  const [specificTimeOptions, setSpecificTimeOptions] = useState<TimeOption[]>([]);
  
  const [onlyBusinessHours] = useState(true);

  // Create constraints object and notify parent
  const updateConstraints = useCallback(() => {
    const constraints: MeetingConstraints = {
      dateRange,
      preferredTimes,
      specificTimeOptions,
      onlyBusinessHours
    };
    onConstraintsChange(constraints);
  }, [dateRange, preferredTimes, specificTimeOptions, onlyBusinessHours, onConstraintsChange]);

  // Update constraints whenever any value changes
  React.useEffect(() => {
    updateConstraints();
  }, [updateConstraints]);

  const addSpecificTimeOption = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const newOption: TimeOption = {
      id: Date.now().toString(),
      date: tomorrow.toISOString().split('T')[0],
      startTime: '14:00',
      endTime: '15:00'
    };
    setSpecificTimeOptions([...specificTimeOptions, newOption]);
  };

  const removeSpecificTimeOption = (id: string) => {
    setSpecificTimeOptions(specificTimeOptions.filter(option => option.id !== id));
  };

  const updateSpecificTimeOption = (id: string, field: keyof TimeOption, value: string) => {
    setSpecificTimeOptions(prev => 
      prev.map(option => 
        option.id === id ? { ...option, [field]: value } : option
      )
    );
  };

  return (
    <Card className={styles.container}>
      <CardHeader
        image={<Calendar24Regular />}
        header={<Text weight="semibold">Meeting Preferences</Text>}
        description={<Caption1>Specify when you'd prefer to schedule this meeting</Caption1>}
      />
      
      <div style={{ padding: "20px" }}>
        {/* Date Range */}
        <div className={styles.section}>
          <Label weight="semibold">Date Range</Label>
          <Caption1>When would you like to schedule this meeting?</Caption1>
          <div className={styles.dateInputs}>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              style={{ width: "140px" }}
            />
            <Text>to</Text>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              style={{ width: "140px" }}
            />
          </div>
        </div>

        {/* Preferred Time Windows */}
        <div className={styles.section}>
          <Label weight="semibold">Preferred Time Windows</Label>
          <Caption1>Which parts of the day work best?</Caption1>
          {preferredTimes.map((timeWindow) => (
            <div key={timeWindow.id} className={styles.preferredTimeRow}>
              <Clock24Regular style={{ fontSize: "16px" }} />
              <Text style={{ flex: 1 }}>{timeWindow.label}</Text>
              <input 
                type="checkbox" 
                checked={timeWindow.enabled}
                onChange={(e) => {
                  // For now, just show the UI - in a full implementation you'd update the state
                  console.log(`${timeWindow.label} ${e.target.checked ? 'enabled' : 'disabled'}`);
                }}
              />
            </div>
          ))}
        </div>

        {/* Specific Time Options */}
        <div className={styles.section}>
          <Label weight="semibold">Propose Specific Times (Optional)</Label>
          <Caption1>Suggest 2-3 specific times for attendees to vote on</Caption1>
          
          {specificTimeOptions.map((option, index) => (
            <div key={option.id} className={styles.timeOption}>
              <Text>Option {index + 1}:</Text>
              <Input
                type="date"
                value={option.date}
                onChange={(e) => updateSpecificTimeOption(option.id, 'date', e.target.value)}
                style={{ width: "140px" }}
              />
              <div className={styles.timeInputs}>
                <Input
                  type="time"
                  value={option.startTime}
                  onChange={(e) => updateSpecificTimeOption(option.id, 'startTime', e.target.value)}
                  style={{ width: "80px" }}
                />
                <Text>to</Text>
                <Input
                  type="time"
                  value={option.endTime}
                  onChange={(e) => updateSpecificTimeOption(option.id, 'endTime', e.target.value)}
                  style={{ width: "80px" }}
                />
              </div>
              <Button 
                appearance="subtle" 
                icon={<Delete24Regular />}
                onClick={() => removeSpecificTimeOption(option.id)}
                size="small"
              />
            </div>
          ))}
          
          <Button 
            appearance="outline" 
            icon={<Add24Regular />} 
            onClick={addSpecificTimeOption}
            size="small"
          >
            Add Specific Time
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default MeetingConstraints; 