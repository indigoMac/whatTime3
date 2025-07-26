// TypeScript interfaces for attendee management in Meeting Optimizer

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
}

export interface ExternalAttendee {
  email: string;
  displayName?: string;
  isExternal: true;
}

export interface InternalAttendee extends GraphUser {
  isExternal: false;
}

export type Attendee = InternalAttendee | ExternalAttendee;

export interface TeamGroup {
  id: string;
  name: string;
  description: string;
  members: string[]; // Array of email addresses
  color?: string;
}

export interface AttendeeSelectionState {
  selectedAttendees: Attendee[];
  teamGroups: TeamGroup[];
  searchQuery: string;
  isSearching: boolean;
  searchResults: GraphUser[];
}

export interface AttendeeSearchProps {
  onUserSelect: (user: GraphUser) => void;
  excludeEmails?: string[];
  placeholder?: string;
}

export interface ExternalAttendeeInputProps {
  onAttendeeAdd: (attendee: ExternalAttendee) => void;
  excludeEmails?: string[];
  placeholder?: string;
}

export interface AttendeeListProps {
  attendees: Attendee[];
  onRemoveAttendee: (attendee: Attendee) => void;
  showDetails?: boolean;
}

export interface TeamGroupSelectorProps {
  groups: TeamGroup[];
  onGroupSelect: (group: TeamGroup) => void;
  selectedGroupIds?: string[];
}

export interface AttendeeSelectorProps {
  value: Attendee[];
  onChange: (attendees: Attendee[]) => void;
  maxAttendees?: number;
  allowTeamGroups?: boolean;
  className?: string;
}

// Predefined team groups for enterprise environments
export const DEFAULT_TEAM_GROUPS: TeamGroup[] = [
  {
    id: 'legal',
    name: 'Legal Team',
    description: 'Legal department members',
    members: [],
    color: '#0078d4'
  },
  {
    id: 'managers',
    name: 'Management',
    description: 'Management team members',
    members: [],
    color: '#107c10'
  },
  {
    id: 'finance',
    name: 'Finance Team',
    description: 'Finance department members',
    members: [],
    color: '#5c2d91'
  },
  {
    id: 'consultants',
    name: 'Consultants',
    description: 'Consulting team members',
    members: [],
    color: '#d83b01'
  }
];

// Utility functions
export const isInternalAttendee = (attendee: Attendee): attendee is InternalAttendee => {
  return !attendee.isExternal;
};

export const isExternalAttendee = (attendee: Attendee): attendee is ExternalAttendee => {
  return attendee.isExternal;
};

export const getAttendeeEmail = (attendee: Attendee): string => {
  return isExternalAttendee(attendee) ? attendee.email : attendee.mail;
};

export const getAttendeeDisplayName = (attendee: Attendee): string => {
  if (isExternalAttendee(attendee)) {
    return attendee.displayName || attendee.email;
  }
  return attendee.displayName;
};

export const createExternalAttendee = (email: string, displayName?: string): ExternalAttendee => {
  return {
    email,
    displayName,
    isExternal: true
  };
};

export const createInternalAttendee = (user: GraphUser): InternalAttendee => {
  return {
    ...user,
    isExternal: false
  };
}; 