import * as React from "react";
import { useState } from "react";
import {
  Button,
  Text,
  Caption1,
  Card,
  CardHeader,
  Badge,
  makeStyles,
  tokens,
  Tooltip
} from "@fluentui/react-components";
import {
  People24Regular,
  Add24Regular,
  CheckmarkCircle24Filled,
  Info24Regular
} from "@fluentui/react-icons";
import {
  TeamGroupSelectorProps,
  TeamGroup,
  DEFAULT_TEAM_GROUPS
} from "../../types/attendee";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px"
  },
  groupsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px"
  },
  groupCard: {
    cursor: "pointer",
    transition: "all 0.2s ease",
    position: "relative",
    ":hover": {
      transform: "translateY(-2px)",
      boxShadow: tokens.shadow4
    }
  },
  selectedCard: {
    backgroundColor: "#f3f9ff"
  },
  cardContent: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  groupInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  colorIndicator: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    flexShrink: 0
  },
  memberCount: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginTop: "4px"
  },
  selectionIndicator: {
    position: "absolute",
    top: "8px",
    right: "8px",
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: "50%",
    padding: "2px"
  },
  emptyState: {
    textAlign: "center",
    padding: "24px",
    color: tokens.colorNeutralForeground3
  }
});

const TeamGroupSelector: React.FC<TeamGroupSelectorProps> = ({
  groups = DEFAULT_TEAM_GROUPS,
  onGroupSelect,
  selectedGroupIds = []
}) => {
  const styles = useStyles();

  const handleGroupClick = (group: TeamGroup) => {
    onGroupSelect(group);
  };

  const isGroupSelected = (groupId: string): boolean => {
    return selectedGroupIds.includes(groupId);
  };

  if (groups.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <People24Regular />
          <Text weight="semibold">Team Groups</Text>
          <Tooltip
            content="Team groups allow you to quickly add multiple attendees based on roles or departments"
            relationship="description"
          >
            <Info24Regular style={{ color: tokens.colorNeutralForeground3 }} />
          </Tooltip>
        </div>
        <div className={styles.emptyState}>
          <Text>No team groups configured</Text>
          <Caption1>Contact your administrator to set up team groups</Caption1>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <People24Regular />
        <Text weight="semibold">Team Groups</Text>
        <Tooltip
          content="Quickly add multiple attendees by selecting team groups"
          relationship="description"
        >
          <Info24Regular style={{ color: tokens.colorNeutralForeground3 }} />
        </Tooltip>
      </div>

      <div className={styles.groupsGrid}>
        {groups.map((group) => {
          const isSelected = isGroupSelected(group.id);
          
          return (
            <Card
              key={group.id}
              className={`${styles.groupCard} ${isSelected ? styles.selectedCard : ''}`}
              onClick={() => handleGroupClick(group)}
              appearance={isSelected ? "filled" : "outline"}
            >
              {isSelected && (
                <CheckmarkCircle24Filled className={styles.selectionIndicator} />
              )}
              
              <div className={styles.cardContent}>
                <div className={styles.groupHeader}>
                  <div className={styles.groupInfo}>
                                         <div
                       className={styles.colorIndicator}
                       style={{ backgroundColor: group.color || "#0078d4" }}
                     />
                    <Text weight="semibold">{group.name}</Text>
                  </div>
                </div>
                
                <Caption1>{group.description}</Caption1>
                
                <div className={styles.memberCount}>
                  <People24Regular style={{ fontSize: "14px", color: tokens.colorNeutralForeground3 }} />
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                    {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                  </Caption1>
                </div>

                {group.members.length > 0 && (
                  <Badge
                    appearance={isSelected ? "filled" : "outline"}
                    size="small"
                    style={{ alignSelf: "flex-start", marginTop: "4px" }}
                  >
                    {isSelected ? "Selected" : "Available"}
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {selectedGroupIds.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            {selectedGroupIds.length} team {selectedGroupIds.length === 1 ? 'group' : 'groups'} selected
          </Caption1>
        </div>
      )}
    </div>
  );
};

export default TeamGroupSelector; 