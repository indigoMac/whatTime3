import React, { useState, useEffect } from "react";
import { Clock, Users, Check, AlertCircle, Eye, Calendar, ChevronRight, X } from "lucide-react";
import { Button } from "./ui/button";
import { authService } from "../services/authService";
import { openOutlookComposeDialog } from '../../lib/office-api';

interface Meeting {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  sentAt: string;
  vitalCount: number;
  optionalCount: number;
  responseStats: {
    totalVitalParticipants: number;
    totalOptionalParticipants?: number;
    respondedCount: number;
    vitalRespondedCount?: number;
    optionalRespondedCount?: number;
    responseRate: number;
    hasConsensus: boolean;
    topChoice: {
      slotId: string;
      count: number;
      vitalCount?: number;
      percentage: number;
      respondents: string[];
    } | null;
    timeSlotCounts: Record<string, {
      count: number;
      percentage: number;
      respondents?: string[];
      voters?: string[];
      slotInfo?: any;
    }>;
  };
}

interface MeetingDetails {
  id: string;
  title: string;
  location: string;
  duration: number;
  status: string;
  createdAt: string;
  sentAt: string;
  confirmedAt?: string;
  vitalParticipants: Array<{ email: string; name: string; priority: string }>;
  optionalParticipants: Array<{ email: string; name: string; priority: string }>;
  proposedTimeSlots: Array<{
    id: string;
    startTime: string;
    endTime: string;
    timezone: string;
  }>;
  selectedTimeSlot?: {
    id: string;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  responseStats: Meeting['responseStats'];
  responses: Array<{
    email: string;
    timeSlotId: string;
    respondedAt: string;
  }>;
}

interface PendingMeetingsViewProps {
  onConfirmMeeting?: (meetingId: string, timeSlotId: string) => void;
}

export function PendingMeetingsView({ onConfirmMeeting }: PendingMeetingsViewProps): JSX.Element {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Polling for real-time updates
  useEffect(() => {
    loadPendingMeetings();
    
    // Poll every 30 seconds for updates
    const pollInterval = setInterval(loadPendingMeetings, 30000);
    
    return () => clearInterval(pollInterval);
  }, []);

  const loadPendingMeetings = async () => {
    try {
      const token = authService.getToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch('http://localhost:3001/api/meetings?status=pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load pending meetings');
      }

      const data = await response.json();
      setMeetings(data.meetings || []);
      setError(null);
    } catch (err) {
      console.error('Error loading pending meetings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeetingDetails = async (meetingId: string) => {
    try {
      const token = authService.getToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`http://localhost:3001/api/meetings/${meetingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load meeting details');
      }

      const data = await response.json();
      setSelectedMeeting(data.meeting);
      
      // Start polling for response updates if we have a meeting
      if (data.meeting) {
        startPollingResponses(meetingId);
      }
    } catch (err) {
      console.error('Error loading meeting details:', err);
      console.error(`❌ Failed to load meeting details: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Poll for response tallies
  const [responsePollingInterval, setResponsePollingInterval] = useState<NodeJS.Timeout | null>(null);

  const startPollingResponses = (meetingId: string) => {
    // Clear any existing polling
    if (responsePollingInterval) {
      clearInterval(responsePollingInterval);
    }

    // Initial fetch
    fetchResponseTallies(meetingId);

    // Poll every 10-15 seconds
    const interval = setInterval(() => {
      fetchResponseTallies(meetingId);
    }, 12000); // 12 seconds

    setResponsePollingInterval(interval);
  };

  const fetchResponseTallies = async (meetingId: string) => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch(`http://localhost:3001/api/meetings/${meetingId}/responses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch response tallies');
        return;
      }

      const tallies = await response.json();
      
      // Update selectedMeeting with new response data
      setSelectedMeeting(prev => {
        if (!prev || prev.id !== meetingId) return prev;
        
        return {
          ...prev,
          responseStats: {
            totalVitalParticipants: tallies.stats.totalVital,
            totalOptionalParticipants: tallies.stats.totalOptional,
            respondedCount: tallies.stats.vitalResponded,
            vitalRespondedCount: tallies.stats.vitalResponded,
            optionalRespondedCount: tallies.stats.optionalResponded,
            responseRate: tallies.stats.totalVital > 0 
              ? Math.round((tallies.stats.vitalResponded / tallies.stats.totalVital) * 100) 
              : 0,
            hasConsensus: false, // Will be computed below
            topChoice: null, // Will be computed below
            timeSlotCounts: {}
          }
        };
      });

      // Find consensus and top choice
      let topChoice = null;
      let maxVitalCount = 0;
      let hasConsensus = false;
      const consensusThreshold = Math.ceil(tallies.stats.totalVital * 0.7);

      Object.entries(tallies.bySlot).forEach(([slotId, slotData]: [string, any]) => {
        if (slotData.count > 0 && slotData.voters) {
          // Count vital voters for this slot
          const vitalVoters = slotData.voters.filter((voter: string) => 
            selectedMeeting?.vitalParticipants.some(p => 
              p.email.toLowerCase() === voter.toLowerCase()
            )
          );
          
          const vitalCount = vitalVoters.length;
          
          if (vitalCount >= consensusThreshold) {
            hasConsensus = true;
          }

          if (vitalCount > maxVitalCount) {
            maxVitalCount = vitalCount;
            topChoice = {
              slotId,
              count: slotData.count,
              vitalCount,
              percentage: tallies.stats.totalVital > 0 
                ? Math.round((vitalCount / tallies.stats.totalVital) * 100)
                : 0,
              respondents: slotData.voters
            };
          }
        }
      });

      // Update with computed values
      setSelectedMeeting(prev => {
        if (!prev || prev.id !== meetingId) return prev;
        
        return {
          ...prev,
          responseStats: {
            ...prev.responseStats,
            hasConsensus,
            topChoice,
            timeSlotCounts: tallies.bySlot
          }
        };
      });

    } catch (err) {
      console.error('Error fetching response tallies:', err);
    }
  };

  // Clean up polling when component unmounts or meeting changes
  useEffect(() => {
    return () => {
      if (responsePollingInterval) {
        clearInterval(responsePollingInterval);
        setResponsePollingInterval(null);
      }
    };
  }, [responsePollingInterval]);

  const handleConfirmMeeting = async (timeSlotId: string) => {
    if (!selectedMeeting) return;

    try {
      setIsConfirming(true);
      const token = authService.getToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`http://localhost:3001/api/meetings/${selectedMeeting.id}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ timeSlotId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to confirm meeting');
      }

      const result = await response.json();
      
      console.log(`🎉 Meeting confirmed! Opening Outlook compose dialog...`);
      
      // Open Outlook compose dialog with pre-filled meeting data
      try {
        await openOutlookComposeDialog(result.meetingData);
        console.log(`📧 Outlook compose dialog opened successfully`);
      } catch (outlookError) {
        console.error('Failed to open Outlook dialog:', outlookError);
        console.log(`⚠️ Could not open Outlook dialog, but meeting was confirmed`);
      }
      
      // Refresh the meetings list and close details
      setSelectedMeeting(null);
      loadPendingMeetings();
      
      if (onConfirmMeeting) {
        onConfirmMeeting(selectedMeeting.id, timeSlotId);
      }
    } catch (err) {
      console.error('Error confirming meeting:', err);
      console.error(`❌ Failed to confirm meeting: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsConfirming(false);
    }
  };

  const formatTimeSlot = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    const dateStr = start.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    const timeStr = `${start.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })} - ${end.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })}`;
    
    return { dateStr, timeStr };
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <Clock className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading pending meetings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
        <p className="text-sm text-muted-foreground mb-4">Failed to load pending meetings</p>
        <Button size="sm" onClick={loadPendingMeetings}>Try Again</Button>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <Users className="h-8 w-8 mx-auto mb-2" />
        <p className="mb-1">No pending meetings</p>
        <p className="text-xs">Meetings awaiting responses will appear here</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Pending Meetings</h2>
        <Button variant="ghost" size="sm" onClick={loadPendingMeetings}>
          Refresh
        </Button>
      </div>

      {meetings.map((meeting) => (
        <div 
          key={meeting.id} 
          className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors cursor-pointer"
          onClick={() => loadMeetingDetails(meeting.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{meeting.title}</h3>
              <p className="text-sm text-muted-foreground">
                Sent {new Date(meeting.sentAt).toLocaleDateString()}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
          </div>

          {/* Response progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Response Progress</span>
              <span className="font-medium">
                {meeting.responseStats.respondedCount}/{meeting.responseStats.totalVitalParticipants}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${meeting.responseStats.responseRate}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{meeting.responseStats.responseRate}% responded</span>
              {meeting.responseStats.hasConsensus && (
                <span className="text-green-600 font-medium">✓ Ready to confirm</span>
              )}
            </div>
          </div>

          {/* Participants count */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {meeting.vitalCount} vital
            </span>
            {meeting.optionalCount > 0 && (
              <span>{meeting.optionalCount} optional</span>
            )}
          </div>
        </div>
      ))}

      {/* Auto-refresh notice */}
      <div className="text-xs text-muted-foreground text-center pt-4 border-t">
        Updates automatically every 30 seconds
      </div>

      {/* Selected meeting details modal */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" onClick={() => {
          // Stop polling when closing the details
          if (responsePollingInterval) {
            clearInterval(responsePollingInterval);
            setResponsePollingInterval(null);
          }
          setSelectedMeeting(null);
        }}>
          <div 
            className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-lg overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedMeeting.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedMeeting.location || 'No location specified'}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    if (responsePollingInterval) {
                      clearInterval(responsePollingInterval);
                      setResponsePollingInterval(null);
                    }
                    setSelectedMeeting(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Meeting Info */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedMeeting.duration} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Sent {new Date(selectedMeeting.sentAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {selectedMeeting.vitalParticipants.length} vital, 
                    {selectedMeeting.optionalParticipants.length} optional participants
                  </span>
                </div>
              </div>

              {/* Response Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="font-medium">Response Summary</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Vital Responses</span>
                    <span className="font-medium">
                      {selectedMeeting.responseStats.vitalRespondedCount || selectedMeeting.responseStats.respondedCount}/
                      {selectedMeeting.responseStats.totalVitalParticipants}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${selectedMeeting.responseStats.responseRate}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedMeeting.responseStats.responseRate}% response rate
                  </div>
                </div>
                {selectedMeeting.responseStats.hasConsensus && (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="font-medium text-sm">Consensus reached!</span>
                  </div>
                )}
              </div>

              {/* Time Options with Votes */}
              <div className="space-y-3">
                <h3 className="font-medium">Time Options & Responses</h3>
                
                {selectedMeeting.proposedTimeSlots.map((slot) => {
                  const voteData = selectedMeeting.responseStats.timeSlotCounts[slot.id] || { 
                    count: 0, 
                    voters: [],
                    slotInfo: {}
                  };
                  const { dateStr, timeStr } = formatTimeSlot(slot.startTime, slot.endTime);
                  const isTopChoice = selectedMeeting.responseStats.topChoice?.slotId === slot.id;
                  
                  // Count vital and optional voters
                  const vitalVoters = voteData.voters?.filter((voter: string) => 
                    selectedMeeting.vitalParticipants.some(p => 
                      p.email.toLowerCase() === voter.toLowerCase()
                    )
                  ) || [];
                  const optionalVoters = voteData.voters?.filter((voter: string) => 
                    selectedMeeting.optionalParticipants.some(p => 
                      p.email.toLowerCase() === voter.toLowerCase()
                    )
                  ) || [];
                  
                  const vitalPercentage = selectedMeeting.responseStats.totalVitalParticipants > 0
                    ? Math.round((vitalVoters.length / selectedMeeting.responseStats.totalVitalParticipants) * 100)
                    : 0;
                  
                  return (
                    <div 
                      key={slot.id} 
                      className={`border rounded-lg p-4 ${isTopChoice ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium">{dateStr}</div>
                          <div className="text-sm text-muted-foreground">{timeStr}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-lg">{voteData.count || 0}</div>
                          <div className="text-xs text-muted-foreground">
                            {vitalPercentage}% vital votes
                          </div>
                          {vitalVoters.length > 0 && optionalVoters.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {vitalVoters.length} vital, {optionalVoters.length} optional
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {voteData.voters && voteData.voters.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-muted-foreground mb-1">Voted for this time:</div>
                          <div className="text-sm">
                            {vitalVoters.map((email: string) => {
                              const participant = selectedMeeting.vitalParticipants.find(p => 
                                p.email.toLowerCase() === email.toLowerCase()
                              );
                              return participant?.name || email.split('@')[0];
                            }).join(', ')}
                            {vitalVoters.length > 0 && optionalVoters.length > 0 && ', '}
                            {optionalVoters.map((email: string) => {
                              const participant = selectedMeeting.optionalParticipants.find(p => 
                                p.email.toLowerCase() === email.toLowerCase()
                              );
                              const name = participant?.name || email.split('@')[0];
                              return `${name} (optional)`;
                            }).join(', ')}
                          </div>
                        </div>
                      )}
                      
                      {isTopChoice && selectedMeeting.responseStats.hasConsensus && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="mb-2 text-sm text-green-600 font-medium">
                            ✓ Quorum reached! {vitalPercentage}% of vital participants agree
                          </div>
                          <Button 
                            className="w-full" 
                            onClick={() => handleConfirmMeeting(slot.id)}
                            disabled={isConfirming}
                          >
                            {isConfirming ? 'Scheduling...' : 'Schedule This Time'}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Participants Status */}
              <div className="space-y-3">
                <h3 className="font-medium">Participant Status</h3>
                
                {/* Vital Participants */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Vital Participants</h4>
                  <div className="space-y-1">
                    {selectedMeeting.vitalParticipants.map((participant) => {
                      const hasResponded = Object.keys(selectedMeeting.responseStats.timeSlotCounts).some(
                        slotId => selectedMeeting.responseStats.timeSlotCounts[slotId].voters?.includes(participant.email)
                      );
                      
                      return (
                        <div key={participant.email} className="flex items-center justify-between text-sm">
                          <span>{participant.name || participant.email}</span>
                          {hasResponded ? (
                            <span className="text-green-600">✓ Responded</span>
                          ) : (
                            <span className="text-muted-foreground">Pending</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Participants */}
                {selectedMeeting.optionalParticipants.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Optional Participants</h4>
                    <div className="space-y-1">
                      {selectedMeeting.optionalParticipants.map((participant) => {
                        const hasResponded = Object.keys(selectedMeeting.responseStats.timeSlotCounts).some(
                          slotId => selectedMeeting.responseStats.timeSlotCounts[slotId].voters?.includes(participant.email)
                        );
                        
                        return (
                          <div key={participant.email} className="flex items-center justify-between text-sm">
                            <span>{participant.name || participant.email}</span>
                            {hasResponded ? (
                              <span className="text-green-600">✓ Responded</span>
                            ) : (
                              <span className="text-muted-foreground">Pending</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}