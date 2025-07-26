import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import {
  Text,
  Caption1,
  Card,
  CardHeader,
  Divider,
  TabList,
  Tab,
  makeStyles,
  tokens
} from "@fluentui/react-components";
import {
  People24Regular,
  Search24Regular,
  Mail24Regular,
  Building24Regular
} from "@fluentui/react-icons";
import InternalUserSearch from "./InternalUserSearch";
import ExternalAttendeeInput from "./ExternalAttendeeInput";
import TeamGroupSelector from "./TeamGroupSelector";
import AttendeeList from "./AttendeeList";
import {
  AttendeeSelectorProps,
  Attendee,
  GraphUser,
  ExternalAttendee,
  TeamGroup,
  createInternalAttendee,
  getAttendeeEmail,
  DEFAULT_TEAM_GROUPS
} from "../../types/attendee";
import { authService } from "../../services/authService";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  inputSection: {
    padding: "16px"
  },
  tabContent: {
    padding: "16px 0"
  },
  warningMessage: {
    padding: "12px",
    backgroundColor: tokens.colorPaletteYellowBackground2,
    border: `1px solid ${tokens.colorPaletteYellowBorder1}`,
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorPaletteYellowForeground1,
    marginBottom: "16px"
  }
});

type TabValue = "search" | "external" | "teams";

const AttendeeSelector: React.FC<AttendeeSelectorProps> = ({
  value = [],
  onChange,
  maxAttendees = 50,
  allowTeamGroups = true,
  className
}) => {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState<TabValue>("search");
  const [teamGroups, setTeamGroups] = useState<TeamGroup[]>(DEFAULT_TEAM_GROUPS);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  // Get list of emails that are already selected to exclude from search
  const excludeEmails = value.map(getAttendeeEmail);

  // Load team group members from backend (placeholder for now)
  useEffect(() => {
    // TODO: Load actual team groups from backend API
    // For now, use default groups with empty members
    setTeamGroups(DEFAULT_TEAM_GROUPS);
  }, []);

  const handleInternalUserSelect = useCallback((user: GraphUser) => {
    if (value.length >= maxAttendees) {
      return;
    }

    const internalAttendee = createInternalAttendee(user);
    const newAttendees = [...value, internalAttendee];
    onChange(newAttendees);
  }, [value, onChange, maxAttendees]);

  const handleExternalAttendeeAdd = useCallback((attendee: ExternalAttendee) => {
    if (value.length >= maxAttendees) {
      return;
    }

    const newAttendees = [...value, attendee];
    onChange(newAttendees);
  }, [value, onChange, maxAttendees]);

  const handleTeamGroupSelect = useCallback(async (group: TeamGroup) => {
    if (group.members.length === 0) {
      // Show warning that group has no members
      console.warn(`Team group ${group.name} has no members configured`);
      return;
    }

    try {
      // Get user details for all group members
      const users = await authService.getUsersByEmails(group.members);
      
      // Convert to internal attendees and filter out already selected ones
      const newInternalAttendees = users
        .filter(user => !excludeEmails.includes(user.mail))
        .map(createInternalAttendee);

      // Check if adding these attendees would exceed the limit
      const totalAfterAdd = value.length + newInternalAttendees.length;
      if (totalAfterAdd > maxAttendees) {
        const canAdd = maxAttendees - value.length;
        if (canAdd > 0) {
          // Add only what we can fit
          const newAttendees = [...value, ...newInternalAttendees.slice(0, canAdd)];
          onChange(newAttendees);
        }
        return;
      }

      const newAttendees = [...value, ...newInternalAttendees];
      onChange(newAttendees);
    } catch (error) {
      console.error('Failed to load team group members:', error);
    }
  }, [value, onChange, maxAttendees, excludeEmails]);

  const handleRemoveAttendee = useCallback((attendeeToRemove: Attendee) => {
    const newAttendees = value.filter(
      attendee => getAttendeeEmail(attendee) !== getAttendeeEmail(attendeeToRemove)
    );
    onChange(newAttendees);
  }, [value, onChange]);

  const isAtMaxCapacity = value.length >= maxAttendees;

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <Card>
        <CardHeader
          image={<People24Regular />}
          header={<Text weight="semibold">Add Attendees</Text>}
          description={
            <Caption1>
              Search for colleagues, add external attendees, or select team groups
            </Caption1>
          }
        />

        <div className={styles.inputSection}>
          {isAtMaxCapacity && (
            <div className={styles.warningMessage}>
              <Text size={200}>
                Maximum number of attendees ({maxAttendees}) reached. Remove attendees to add more.
              </Text>
            </div>
          )}

          <TabList
            selectedValue={selectedTab}
            onTabSelect={(_, data) => setSelectedTab(data.value as TabValue)}
            size="medium"
          >
            <Tab value="search" icon={<Search24Regular />}>
              Internal Users
            </Tab>
            <Tab value="external" icon={<Mail24Regular />}>
              External
            </Tab>
            {allowTeamGroups && (
              <Tab value="teams" icon={<Building24Regular />}>
                Team Groups
              </Tab>
            )}
          </TabList>

          <div className={styles.tabContent}>
            {selectedTab === "search" && (
              <InternalUserSearch
                onUserSelect={handleInternalUserSelect}
                excludeEmails={excludeEmails}
                placeholder={
                  isAtMaxCapacity 
                    ? "Remove attendees to add more"
                    : "Search for colleagues by name or email"
                }
              />
            )}

            {selectedTab === "external" && (
              <ExternalAttendeeInput
                onAttendeeAdd={handleExternalAttendeeAdd}
                excludeEmails={excludeEmails}
                placeholder={
                  isAtMaxCapacity
                    ? "Remove attendees to add more"
                    : "Enter external email address"
                }
              />
            )}

            {selectedTab === "teams" && allowTeamGroups && (
              <TeamGroupSelector
                groups={teamGroups}
                onGroupSelect={handleTeamGroupSelect}
              />
            )}
          </div>
        </div>
      </Card>

      {value.length > 0 && (
        <>
          <Divider />
          <AttendeeList
            attendees={value}
            onRemoveAttendee={handleRemoveAttendee}
            showDetails={true}
          />
        </>
      )}
    </div>
  );
};

export default AttendeeSelector; 