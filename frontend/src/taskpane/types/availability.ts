// TypeScript interfaces for calendar availability in Meeting Optimizer

export interface FreeBusyTime {
  start: string; // ISO date string
  end: string;   // ISO date string
}

export interface AttendeeAvailability {
  email: string;
  displayName: string;
  isExternal: boolean;
  freeBusyViewType: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  freeBusyTimes: FreeBusyTime[];
  error?: string; // For external attendees with limited access
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  isAvailable: boolean;
  conflictCount: number;
  attendeesAvailable: string[]; // emails
  attendeesConflict: string[];  // emails
  confidence: number; // 0-100 score
}

export interface AvailabilityRequest {
  attendees: string[]; // email addresses
  startTime: string;   // ISO date string
  endTime: string;     // ISO date string
  duration: number;    // minutes
  timeZone?: string;
}

export interface AvailabilityResponse {
  attendeesAvailability: AttendeeAvailability[];
  suggestedSlots: AvailabilitySlot[];
  timeRange: {
    start: string;
    end: string;
    timeZone: string;
  };
}

export interface CalendarViewProps {
  availabilityData: AvailabilityResponse;
  selectedSlot?: AvailabilitySlot;
  onSlotSelect: (slot: AvailabilitySlot) => void;
}

export interface AvailabilityListProps {
  availabilityData: AvailabilityResponse;
  onSlotSelect: (slot: AvailabilitySlot) => void;
  selectedSlot?: AvailabilitySlot;
}

// Time zone utilities
export interface TimeZoneInfo {
  id: string;
  displayName: string;
  offset: string;
}

export const DEFAULT_TIME_ZONES: TimeZoneInfo[] = [
  { id: 'UTC', displayName: 'UTC (Coordinated Universal Time)', offset: '+00:00' },
  { id: 'America/New_York', displayName: 'Eastern Time (US & Canada)', offset: '-05:00' },
  { id: 'America/Chicago', displayName: 'Central Time (US & Canada)', offset: '-06:00' },
  { id: 'America/Denver', displayName: 'Mountain Time (US & Canada)', offset: '-07:00' },
  { id: 'America/Los_Angeles', displayName: 'Pacific Time (US & Canada)', offset: '-08:00' },
  { id: 'Europe/London', displayName: 'Greenwich Mean Time (London)', offset: '+00:00' },
  { id: 'Europe/Paris', displayName: 'Central European Time (Paris)', offset: '+01:00' },
  { id: 'Asia/Tokyo', displayName: 'Japan Standard Time (Tokyo)', offset: '+09:00' },
  { id: 'Asia/Shanghai', displayName: 'China Standard Time (Shanghai)', offset: '+08:00' },
]; 