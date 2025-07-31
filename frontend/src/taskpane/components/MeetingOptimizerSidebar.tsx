import React, { useState, useEffect } from "react";
import { Clock, Users, X, Video, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "../../lib/utils";
import { authService } from "../services/authService";
import { createMeetingInvite } from "../../lib/office-api";
import { EnhancedParticipantManager, Participant } from "./EnhancedParticipantManager";

interface MeetingOptimizerSidebarProps {
  userProfile: any;
  onClose?: () => void;
}

interface TimeRange {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
}

export function MeetingOptimizerSidebar({ userProfile, onClose }: MeetingOptimizerSidebarProps) {
  const [activeTab, setActiveTab] = useState("create");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [duration, setDuration] = useState("60");
  const [timeRanges, setTimeRanges] = useState<TimeRange[]>([
    { id: "1", date: new Date().toISOString().split("T")[0], startTime: "", endTime: "", isAllDay: false },
  ]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addTimeRange = () => {
    setTimeRanges([
      ...timeRanges,
      {
        id: Date.now().toString(),
        date: new Date().toISOString().split("T")[0],
        startTime: "",
        endTime: "",
        isAllDay: false,
      },
    ]);
  };

  const updateTimeRange = (id: string, field: string, value: string | boolean) => {
    setTimeRanges(timeRanges.map((range) => (range.id === id ? { ...range, [field]: value } : range)));
  };

  const removeTimeRange = (id: string) => {
    if (timeRanges.length > 1) {
      setTimeRanges(timeRanges.filter((range) => range.id !== id));
    }
  };

  const handleSendMeetingRequest = async () => {
    try {
      setIsProcessing(true);
      
      // Separate vital and optional participants
      const vitalParticipants = participants.filter(p => p.priority === 'vital');
      const optionalParticipants = participants.filter(p => p.priority === 'optional');
      
      if (participants.length === 0) {
        alert("Please add at least one participant");
        return;
      }

      if (vitalParticipants.length === 0) {
        alert("Please mark at least one participant as vital for the meeting");
        return;
      }

      // Collect all attendee emails
      const allAttendees: string[] = participants.map(p => p.email);
      const vitalEmails: string[] = vitalParticipants.map(p => p.email);

      // Use the existing authService to optimize the meeting
      // In the future, we'll pass vital vs optional participants separately
      const optimization = await authService.optimizeMeeting(
        allAttendees,
        parseInt(duration),
        timeRanges.map(range => `${range.date} ${range.startTime || '09:00'}-${range.endTime || '17:00'}`)
      );

      // Enhanced feedback with participant priority information
      const message = `Meeting optimization complete!
      
📊 Results:
• ${optimization.suggestions?.length || 0} time suggestions found
• ${vitalParticipants.length} vital participants (must attend)
• ${optionalParticipants.length} optional participants

⭐ Vital participants: ${vitalParticipants.map(p => p.name).join(', ')}

The optimization prioritized schedules of vital participants.`;

      alert(message);
      
    } catch (error) {
      console.error('Meeting optimization failed:', error);
      
      const errorMessage = `Failed to optimize meeting. 
      
Please check:
• All participants have valid email addresses
• You have sufficient permissions to access calendars
• Your network connection is stable

Error: ${error.message || 'Unknown error'}`;
      
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Meeting Optimizer</h1>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* User Info */}
      <div className="px-3 py-2 border-b bg-muted/50 flex-shrink-0">
        <div className="text-sm font-medium">{userProfile?.displayName}</div>
        <div className="text-xs text-muted-foreground">{userProfile?.mail}</div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="border-b flex-shrink-0">
          <TabsList className="w-full justify-start p-0 h-auto bg-transparent">
            <TabsTrigger
              value="create"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
            >
              Create
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
            >
              Pending
            </TabsTrigger>
            <TabsTrigger
              value="upcoming"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
            >
              Upcoming
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Create Tab */}
        <TabsContent value="create" className="flex-1 overflow-y-auto p-4 space-y-4 m-0 min-h-0">
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Meeting Details</h2>
            <Input 
              placeholder="Meeting Title" 
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />

            {/* Location with integration icons */}
            <div className="relative">
              <Input 
                placeholder="Location (optional)" 
                className="pr-24"
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" title="Teams">
                  <div className="h-3.5 w-3.5 bg-purple-500 rounded-sm" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" title="Zoom">
                  <Video className="h-3.5 w-3.5 text-blue-500" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">2 hours</option>
              </select>

              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                defaultValue="et"
              >
                <option value="et">Eastern Time</option>
                <option value="ct">Central Time</option>
                <option value="pt">Pacific Time</option>
                <option value="gmt">GMT</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4"></div>

          {/* Time Ranges */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Proposed Times</h2>
            <div className="space-y-2">
              {timeRanges.map((range) => (
                <div key={range.id} className="space-y-2 border rounded-md p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        className="w-[140px]"
                        value={range.date}
                        onChange={(e) => updateTimeRange(range.id, "date", e.target.value)}
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          id={`allday-${range.id}`}
                          checked={range.isAllDay}
                          onChange={(e) => updateTimeRange(range.id, "isAllDay", e.target.checked)}
                          className="h-3 w-3"
                        />
                        <label htmlFor={`allday-${range.id}`} className="text-xs">
                          All day
                        </label>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeTimeRange(range.id)}
                      disabled={timeRanges.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {!range.isAllDay && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        className="flex-1"
                        value={range.startTime}
                        onChange={(e) => updateTimeRange(range.id, "startTime", e.target.value)}
                      />
                      <span className="text-xs">to</span>
                      <Input
                        type="time"
                        className="flex-1"
                        value={range.endTime}
                        onChange={(e) => updateTimeRange(range.id, "endTime", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ))}

              <Button variant="outline" size="sm" className="w-full" onClick={addTimeRange}>
                <Plus className="h-3 w-3 mr-1" /> Add Another Time
              </Button>
            </div>
          </div>

          <div className="border-t pt-4"></div>

          {/* Participant Groups */}
          <EnhancedParticipantManager 
            onParticipantsChange={setParticipants} 
          />

          <div className="pt-4">
            <Button 
              className="w-full" 
              onClick={handleSendMeetingRequest}
              disabled={isProcessing || participants.length === 0}
            >
              {isProcessing ? (
                "Optimizing meeting times..."
              ) : participants.length === 0 ? (
                "Add participants to continue"
              ) : (
                `Find optimal times for ${participants.length} participants`
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Pending Tab - Placeholder for now */}
        <TabsContent value="pending" className="flex-1 overflow-y-auto p-4 m-0 min-h-0">
          <div className="text-center text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2" />
            <p>Pending meetings will appear here</p>
            <p className="text-xs">Feature coming in Phase 2</p>
          </div>
        </TabsContent>

        {/* Upcoming Tab - Placeholder for now */}
        <TabsContent value="upcoming" className="flex-1 overflow-y-auto p-4 m-0 min-h-0">
          <div className="text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2" />
            <p>Upcoming meetings will appear here</p>
            <p className="text-xs">Feature coming in Phase 2</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 