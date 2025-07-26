import * as React from "react";
import {
  Button,
  Text,
  Caption1,
  Avatar,
  makeStyles,
  tokens
} from "@fluentui/react-components";
import {
  Delete24Regular,
  Person24Regular,
  Mail24Regular,
  Building24Regular
} from "@fluentui/react-icons";
import {
  AttendeeListProps,
  Attendee,
  isInternalAttendee,
  isExternalAttendee,
  getAttendeeEmail,
  getAttendeeDisplayName
} from "../../types/attendee";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px"
  },
  attendeeItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    border: "1px solid #e1e1e1",
    borderRadius: "6px",
    backgroundColor: "#ffffff",
    ":hover": {
      backgroundColor: "#f9f9f9"
    }
  },
  attendeeDetails: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0
  },
  attendeeMeta: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "4px"
  },
  typeIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "4px"
  },
  removeButton: {
    opacity: 0.7,
    ":hover": {
      opacity: 1
    }
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px",
    textAlign: "center",
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2
  },
  emptyIcon: {
    marginBottom: "8px",
    color: tokens.colorNeutralForeground3
  }
});

const AttendeeList: React.FC<AttendeeListProps> = ({
  attendees,
  onRemoveAttendee,
  showDetails = true
}) => {
  const styles = useStyles();

  if (attendees.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Person24Regular className={styles.emptyIcon} />
          <Text weight="semibold">No attendees added</Text>
          <Caption1>Search for colleagues or add external attendees</Caption1>
        </div>
      </div>
    );
  }

  const internalAttendees = attendees.filter(isInternalAttendee);
  const externalAttendees = attendees.filter(isExternalAttendee);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text weight="semibold">
          Attendees ({attendees.length})
        </Text>
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
          {internalAttendees.length} internal • {externalAttendees.length} external
        </Caption1>
      </div>

      {attendees.map((attendee, index) => (
        <div key={`${getAttendeeEmail(attendee)}-${index}`} className={styles.attendeeItem}>
          <Avatar
            name={getAttendeeDisplayName(attendee)}
            size={36}
            badge={
              isInternalAttendee(attendee)
                ? { status: "available" }
                : undefined
            }
          />
          
          <div className={styles.attendeeDetails}>
            <Text weight="semibold">{getAttendeeDisplayName(attendee)}</Text>
            <Caption1>{getAttendeeEmail(attendee)}</Caption1>
            
            {showDetails && (
              <div className={styles.attendeeMeta}>
                <div className={styles.typeIndicator}>
                  {isInternalAttendee(attendee) ? (
                    <>
                      <Building24Regular style={{ fontSize: "12px", color: tokens.colorBrandForeground1 }} />
                      <Caption1 style={{ color: tokens.colorBrandForeground1 }}>
                        Internal
                      </Caption1>
                    </>
                  ) : (
                    <>
                      <Mail24Regular style={{ fontSize: "12px", color: tokens.colorPaletteDarkOrangeForeground1 }} />
                      <Caption1 style={{ color: tokens.colorPaletteDarkOrangeForeground1 }}>
                        External
                      </Caption1>
                    </>
                  )}
                </div>
                
                {isInternalAttendee(attendee) && attendee.jobTitle && (
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                    • {attendee.jobTitle}
                  </Caption1>
                )}
              </div>
            )}
          </div>

          <Button
            appearance="subtle"
            icon={<Delete24Regular />}
            onClick={() => onRemoveAttendee(attendee)}
            size="small"
            className={styles.removeButton}
            title="Remove attendee"
          />
        </div>
      ))}
    </div>
  );
};

export default AttendeeList; 