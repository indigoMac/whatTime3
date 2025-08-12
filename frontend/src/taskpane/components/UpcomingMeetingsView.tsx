import React, { useState, useEffect } from "react";
import { Calendar, MapPin, Clock, Users, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { authService } from "../services/authService";

interface UpcomingMeeting {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  confirmedAt: string;
  vitalCount: number;
  optionalCount: number;
  responseStats: {
    totalVitalParticipants: number;
    respondedCount: number;
    responseRate: number;
  };
}

interface MeetingDetails {
  id: string;
  title: string;
  location: string;
  duration: number;
  status: string;
  confirmedAt: string;
  vitalParticipants: Array<{ email: string; name: string; priority: string }>;
  optionalParticipants: Array<{ email: string; name: string; priority: string }>;
  selectedTimeSlot: {
    id: string;
    startTime: string;
    endTime: string;
    timezone: string;
  } | null;
  outlookEventId?: string;
  outlookWebLink?: string;
}

export function UpcomingMeetingsView(): JSX.Element {
  const [meetings, setMeetings] = useState<UpcomingMeeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUpcomingMeetings();
  }, []);

  const loadUpcomingMeetings = async () => {
    try {
      const token = authService.getToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch('http://localhost:3001/api/meetings?status=confirmed', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load upcoming meetings');
      }

      const data = await response.json();
      setMeetings(data.meetings || []);
      setError(null);
    } catch (err) {
      console.error('Error loading upcoming meetings:', err);
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

  const formatMeetingTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    const isToday = start.toDateString() === new Date().toDateString();
    const isTomorrow = start.toDateString() === new Date(Date.now() + 24 * 60 * 60 * 1000).toDateString();
    
    let dateStr;
    if (isToday) {
      dateStr = 'Today';
    } else if (isTomorrow) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = start.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    const timeStr = `${start.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })} - ${end.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })}`;
    
    return { dateStr, timeStr, fullDate: start.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })};
  };

  const openInOutlook = () => {
    if (selectedMeeting?.outlookWebLink) {
      // Use the official webLink from Microsoft Graph
      console.log('🔗 Opening meeting in Outlook:', selectedMeeting.outlookWebLink);
      window.open(selectedMeeting.outlookWebLink, '_blank');
    } else if (selectedMeeting?.outlookEventId) {
      // Fallback to constructed URL if webLink not available
      const outlookUrl = `https://outlook.office.com/calendar/item/${selectedMeeting.outlookEventId}`;
      console.log('🔗 Opening meeting in Outlook (fallback):', outlookUrl);
      window.open(outlookUrl, '_blank');
    } else {
      console.error('❌ Outlook event information not available');
    }
  };

  if (selectedMeeting) {
    const timeInfo = selectedMeeting.selectedTimeSlot 
      ? formatMeetingTime(selectedMeeting.selectedTimeSlot.startTime, selectedMeeting.selectedTimeSlot.endTime)
      : null;

    return (
      <div className="p-4 space-y-4">
        {/* Back button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setSelectedMeeting(null)}
          className="mb-4"
        >
          ← Back to Upcoming Meetings
        </Button>

        {/* Meeting header */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{selectedMeeting.title}</h2>
          
          {timeInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">{timeInfo.fullDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800">{timeInfo.timeStr}</span>
                <span className="text-sm text-blue-600">({selectedMeeting.duration} min)</span>
              </div>
            </div>
          )}

          {selectedMeeting.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{selectedMeeting.location}</span>
            </div>
          )}
        </div>

        {/* Meeting actions */}
        <div className="flex gap-2">
          <Button 
            className="flex-1"
            onClick={openInOutlook}
            disabled={!selectedMeeting.outlookEventId}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in Outlook
          </Button>
        </div>

        {/* Attendees */}
        <div className="space-y-3">
          <h3 className="font-medium">Attendees</h3>
          
          {selectedMeeting.vitalParticipants.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Required Attendees</h4>
              {selectedMeeting.vitalParticipants.map((participant) => (
                <div key={participant.email} className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{participant.name}</div>
                    <div className="text-xs text-muted-foreground">{participant.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedMeeting.optionalParticipants.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Optional Attendees</h4>
              {selectedMeeting.optionalParticipants.map((participant) => (
                <div key={participant.email} className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                  <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{participant.name}</div>
                    <div className="text-xs text-muted-foreground">{participant.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meeting info */}
        <div className="pt-4 border-t text-xs text-muted-foreground">
          <p>Meeting confirmed on {new Date(selectedMeeting.confirmedAt).toLocaleDateString()}</p>
          {selectedMeeting.outlookEventId && (
            <p className="mt-1">Event ID: {selectedMeeting.outlookEventId}</p>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <Clock className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading upcoming meetings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
        <p className="text-sm text-muted-foreground mb-4">Failed to load upcoming meetings</p>
        <Button size="sm" onClick={loadUpcomingMeetings}>Try Again</Button>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <Calendar className="h-8 w-8 mx-auto mb-2" />
        <p className="mb-1">No upcoming meetings</p>
        <p className="text-xs">Confirmed meetings will appear here</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Upcoming Meetings</h2>
        <Button variant="ghost" size="sm" onClick={loadUpcomingMeetings}>
          Refresh
        </Button>
      </div>

      {meetings
        .sort((a, b) => new Date(a.confirmedAt).getTime() - new Date(b.confirmedAt).getTime())
        .map((meeting) => (
          <div 
            key={meeting.id} 
            className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => loadMeetingDetails(meeting.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{meeting.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Confirmed {new Date(meeting.confirmedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right text-sm">
                <div className="text-blue-600 font-medium">Confirmed</div>
              </div>
            </div>

            {/* Participants count */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {meeting.vitalCount} required
              </span>
              {meeting.optionalCount > 0 && (
                <span>{meeting.optionalCount} optional</span>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}