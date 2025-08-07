import React, { useState, useEffect } from "react";
import { Clock, Users, Check, AlertCircle, Eye, Calendar, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { authService } from "../services/authService";

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
    respondedCount: number;
    responseRate: number;
    hasConsensus: boolean;
    topChoice: {
      slotId: string;
      count: number;
      percentage: number;
      respondents: string[];
    } | null;
    timeSlotCounts: Record<string, {
      count: number;
      percentage: number;
      respondents: string[];
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
    } catch (err) {
      console.error('Error loading meeting details:', err);
      console.error(`❌ Failed to load meeting details: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

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
      
      console.log(`🎉 Meeting confirmed successfully!\n\nOutlook invites have been sent to all participants.\nThe meeting will now appear in your Upcoming tab.`);
      
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

  if (selectedMeeting) {
    return (
      <div className="p-4 space-y-4">
        {/* Back button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setSelectedMeeting(null)}
          className="mb-4"
        >
          ← Back to Pending Meetings
        </Button>

        {/* Meeting header */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{selectedMeeting.title}</h2>
          {selectedMeeting.location && (
            <p className="text-sm text-muted-foreground">📍 {selectedMeeting.location}</p>
          )}
          <p className="text-sm text-muted-foreground">⏱️ {selectedMeeting.duration} minutes</p>
        </div>

        {/* Response Progress */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Response Progress</h3>
            <span className="text-sm font-medium">
              {selectedMeeting.responseStats.respondedCount}/{selectedMeeting.responseStats.totalVitalParticipants} responses
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${selectedMeeting.responseStats.responseRate}%` }}
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            {selectedMeeting.responseStats.responseRate}% of vital participants have responded
            {selectedMeeting.responseStats.hasConsensus && (
              <span className="text-green-600 font-medium ml-2">✓ Consensus reached!</span>
            )}
          </div>
        </div>

        {/* Time Options with Votes */}
        <div className="space-y-3">
          <h3 className="font-medium">Time Options & Responses</h3>
          
          {selectedMeeting.proposedTimeSlots.map((slot) => {
            const voteData = selectedMeeting.responseStats.timeSlotCounts[slot.id] || { count: 0, percentage: 0, respondents: [] };
            const { dateStr, timeStr } = formatTimeSlot(slot.startTime, slot.endTime);
            const isTopChoice = selectedMeeting.responseStats.topChoice?.slotId === slot.id;
            
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
                    <div className="font-semibold text-lg">{voteData.count}</div>
                    <div className="text-xs text-muted-foreground">
                      {voteData.percentage}% votes
                    </div>
                  </div>
                </div>
                
                {voteData.respondents.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-muted-foreground mb-1">Voted for this time:</div>
                    <div className="text-sm">
                      {voteData.respondents.map(email => {
                        const participant = selectedMeeting.vitalParticipants.find(p => p.email === email);
                        return participant?.name || email.split('@')[0];
                      }).join(', ')}
                    </div>
                  </div>
                )}
                
                {isTopChoice && selectedMeeting.responseStats.hasConsensus && (
                  <div className="mt-3 pt-3 border-t">
                    <Button 
                      className="w-full" 
                      onClick={() => handleConfirmMeeting(slot.id)}
                      disabled={isConfirming}
                    >
                      {isConfirming ? 'Confirming...' : 'Confirm This Time & Send Invites'}
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
          
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Vital Participants</h4>
            {selectedMeeting.vitalParticipants.map((participant) => {
              const response = selectedMeeting.responses.find(r => r.email === participant.email);
              const hasResponded = !!response;
              
              return (
                <div key={participant.email} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div>
                    <div className="font-medium text-sm">{participant.name}</div>
                    <div className="text-xs text-muted-foreground">{participant.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasResponded ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-600">Responded</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 text-orange-600" />
                        <span className="text-xs text-orange-600">Pending</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auto-refresh notice */}
        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Updates automatically every 30 seconds
        </div>
      </div>
    );
  }

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
    </div>
  );
}