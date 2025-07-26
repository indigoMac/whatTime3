import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import {
  Input,
  Button,
  Text,
  Caption1,
  Spinner,
  makeStyles,
  Dropdown,
  Option,
  Avatar,
  tokens
} from "@fluentui/react-components";
import {
  Search24Regular,
  Person24Regular,
  Building24Regular
} from "@fluentui/react-icons";
import { authService } from "../../services/authService";
import { GraphUser, AttendeeSearchProps } from "../../types/attendee";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  searchContainer: {
    display: "flex",
    gap: "8px",
    alignItems: "center"
  },
  resultsContainer: {
    maxHeight: "200px",
    overflowY: "auto",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1
  },
  userItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    cursor: "pointer",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover
    },
    ":last-child": {
      borderBottom: "none"
    }
  },
  userDetails: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0
  },
  noResults: {
    padding: "20px",
    textAlign: "center",
    color: tokens.colorNeutralForeground3
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    gap: "8px"
  }
});

// Debounce hook for search input
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const InternalUserSearch: React.FC<AttendeeSearchProps> = ({
  onUserSelect,
  excludeEmails = [],
  placeholder = "Search for colleagues..."
}) => {
  const styles = useStyles();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GraphUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      
      const result = await authService.searchUsers(query, 10);
      
      // Filter out users that are already selected
      const filteredUsers = result.users.filter(
        user => !excludeEmails.includes(user.mail) && !excludeEmails.includes(user.userPrincipalName)
      );
      
      setSearchResults(filteredUsers);
      setShowResults(true);
    } catch (err: any) {
      console.error('User search failed:', err);
      setError(err.message || 'Failed to search users');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [excludeEmails]);

  useEffect(() => {
    searchUsers(debouncedSearchQuery);
  }, [debouncedSearchQuery, searchUsers]);

  const handleUserSelect = (user: GraphUser) => {
    onUserSelect(user);
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  const handleInputBlur = () => {
    // Delay hiding results to allow for clicking on items
    setTimeout(() => {
      setShowResults(false);
    }, 150);
  };

  const getInitials = (displayName: string): string => {
    return displayName
      .split(" ")
      .map(name => name.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchContainer}>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => debouncedSearchQuery && setShowResults(true)}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          contentBefore={<Search24Regular />}
          style={{ flex: 1 }}
        />
      </div>

      {showResults && (
        <div className={styles.resultsContainer}>
          {isSearching ? (
            <div className={styles.loadingContainer}>
              <Spinner size="small" />
              <Text>Searching...</Text>
            </div>
          ) : error ? (
            <div className={styles.noResults}>
              <Text>{error}</Text>
            </div>
          ) : searchResults.length === 0 ? (
            <div className={styles.noResults}>
              <Text>No users found</Text>
              <Caption1>Try a different search term</Caption1>
            </div>
          ) : (
            searchResults.map((user) => (
              <div
                key={user.id}
                className={styles.userItem}
                onClick={() => handleUserSelect(user)}
              >
                <Avatar
                  name={user.displayName}
                  badge={{ status: "available" }}
                  size={32}
                />
                <div className={styles.userDetails}>
                  <Text weight="semibold">{user.displayName}</Text>
                  <Caption1>{user.mail}</Caption1>
                  {user.jobTitle && (
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {user.jobTitle}
                      {user.department && ` • ${user.department}`}
                    </Caption1>
                  )}
                </div>
                <Person24Regular style={{ color: tokens.colorNeutralForeground3 }} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default InternalUserSearch; 