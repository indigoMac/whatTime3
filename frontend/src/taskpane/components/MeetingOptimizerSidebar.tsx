import React, { useState, useEffect } from "react";
import { Users, X, Video, Plus, Trash2, Eye, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "../../lib/utils";
import { authService } from "../services/authService";
import { createMeetingInvite } from "../../lib/office-api";
import { EnhancedParticipantManager, Participant } from "./EnhancedParticipantManager";
import { PendingMeetingsView } from "./PendingMeetingsView";
import { UpcomingMeetingsView } from "./UpcomingMeetingsView";

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
        console.error("❌ Please add at least one participant");
        return;
      }

      if (vitalParticipants.length === 0) {
        console.error("❌ Please mark at least one participant as vital for the meeting");
        return;
      }

      if (!meetingTitle.trim()) {
        console.error("❌ Please enter a meeting title");
        return;
      }

      // Validate time ranges
      const validTimeRanges = timeRanges.filter(range => {
        if (range.isAllDay) return range.date;
        return range.date && range.startTime && range.endTime;
      });

      if (validTimeRanges.length === 0) {
        console.error("❌ Please add at least one valid time range");
        return;
      }

      // Create time slot proposals from time ranges
      const proposedTimeSlots = validTimeRanges.map((range) => {
        if (range.isAllDay) {
          const startDate = new Date(range.date);
          startDate.setHours(9, 0, 0, 0); // Default to 9 AM
          const endDate = new Date(startDate);
          endDate.setTime(startDate.getTime() + parseInt(duration) * 60 * 1000);
          
          return {
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString()
          };
        } else {
          const startDateTime = new Date(`${range.date}T${range.startTime}`);
          const endDateTime = new Date(`${range.date}T${range.endTime}`);
          
          return {
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString()
          };
        }
      });

      // Create meeting proposal
      const meetingData = {
        title: meetingTitle.trim(),
        location: meetingLocation.trim(),
        duration: parseInt(duration),
        timeZone: 'UTC', // TODO: Get from timezone selector
        description: '', // Could be added later
        vitalParticipants: vitalParticipants.map(p => ({
          email: p.email,
          name: p.name
        })),
        optionalParticipants: optionalParticipants.map(p => ({
          email: p.email,
          name: p.name
        })),
        proposedTimeSlots
      };

      // Get auth token
      const token = authService.getToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Create meeting proposal
      const createResponse = await fetch('http://localhost:3001/api/meetings/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(meetingData)
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Failed to create meeting proposal');
      }

      const createResult = await createResponse.json();
      const meetingId = createResult.meetingId;

      // Send proposals to vital participants
      const sendResponse = await fetch(`http://localhost:3001/api/meetings/${meetingId}/send-proposals`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Don't send baseUrl - let the server use PUBLIC_API_BASE from env
          // This allows proper HTTPS URLs for ngrok/production
        })
      });

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json();
        throw new Error(errorData.error || 'Failed to send proposals');
      }

      const sendResult = await sendResponse.json();

      // Success feedback - using console since alert() isn't supported in Office Add-ins
      const message = `🎉 Meeting proposal sent successfully!

📧 Time selection emails sent to:
${vitalParticipants.map(p => `• ${p.name} (${p.email})`).join('\n')}

📋 Meeting Details:
• Title: ${meetingTitle}
• Duration: ${duration} minutes
• Time options: ${proposedTimeSlots.length}

The meeting will appear in your Pending tab. You'll see real-time updates as participants respond.`;

      console.log("SUCCESS:", message);
      
      // Show success in UI by switching to pending tab
      console.log("✅ Meeting created successfully! Check the Pending tab for real-time updates.");

      // Switch to pending tab
      setActiveTab('pending');

      // Clear form
      setMeetingTitle('');
      setMeetingLocation('');
      setTimeRanges([{ id: "1", date: new Date().toISOString().split("T")[0], startTime: "", endTime: "", isAllDay: false }]);
      setParticipants([]);
      
    } catch (error) {
      console.error('Meeting proposal failed:', error);
      
      const errorMessage = `Failed to send meeting proposal. 
      
Please check:
• All participants have valid email addresses
• Your network connection is stable
• The meeting details are complete

Error: ${error.message || 'Unknown error'}`;
      
      console.error("MEETING ERROR:", errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Logo space - will be handled by Outlook's manifest icons */}
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
                        step="900"
                        className="flex-1"
                        value={range.startTime}
                        onChange={(e) => updateTimeRange(range.id, "startTime", e.target.value)}
                      />
                      <span className="text-xs">to</span>
                      <Input
                        type="time"
                        step="900"
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

          <div className="pt-4 flex gap-2">
            <Button 
              variant="outline"
              className="flex-1 min-w-0" 
              size="sm"
              onClick={() => {
                if (participants.length === 0) {
                  console.error("❌ Please add participants first");
                  return;
                }
                
                // Show email preview
                const vitalParticipants = participants.filter(p => p.priority === 'vital');
                const optionalParticipants = participants.filter(p => p.priority === 'optional');
                
                const previewData = {
                  title: meetingTitle || "Your Meeting Title",
                  duration: duration,
                  timeRanges: timeRanges.filter(range => {
                    if (range.isAllDay) return range.date;
                    return range.date && range.startTime && range.endTime;
                  }),
                  vitalParticipants,
                  optionalParticipants
                };
                
                console.log("📧 EMAIL PREVIEW:");
                console.log("=================");
                console.log(`📋 Meeting: ${previewData.title}`);
                console.log(`⏱️  Duration: ${previewData.duration} minutes`);
                console.log(`📅 Time Options: ${previewData.timeRanges.length}`);
                console.log("");
                console.log("📧 Emails will be sent to:");
                console.log("Vital Participants (must respond):");
                vitalParticipants.forEach((p, i) => {
                  console.log(`  ${i+1}. ${p.name} (${p.email})`);
                });
                if (optionalParticipants.length > 0) {
                  console.log("Optional Participants (included in final invite):");
                  optionalParticipants.forEach((p, i) => {
                    console.log(`  ${i+1}. ${p.name} (${p.email})`);
                  });
                }
                console.log("");
                console.log("📨 Each vital participant will receive:");
                console.log("- Interactive HTML email with clickable time buttons");
                console.log("- Unique tracking URLs for response monitoring");
                console.log("- Mobile-friendly responsive design");
                console.log("- Plain text fallback for accessibility");
                console.log("=================");
              }}
              disabled={isProcessing || participants.length === 0}
            >
              <Eye className="h-3 w-3 mr-1" />
              <span className="truncate">
                {participants.length === 0 ? "Add people" : "Preview"}
              </span>
            </Button>
            
            <Button 
              className="flex-1 min-w-0" 
              size="sm"
              onClick={handleSendMeetingRequest}
              disabled={isProcessing || participants.length === 0}
            >
              <Send className="h-3 w-3 mr-1" />
              <span className="truncate">
                {isProcessing ? (
                  "Sending..."
                ) : participants.length === 0 ? (
                  "Add people"
                ) : (
                  "Send"
                )}
              </span>
            </Button>
          </div>
        </TabsContent>

        {/* Pending Tab - Enhanced with real-time updates */}
        <TabsContent value="pending" className="flex-1 overflow-y-auto m-0 min-h-0">
          <PendingMeetingsView 
            onConfirmMeeting={(meetingId, timeSlotId) => {
              console.log('Meeting confirmed:', { meetingId, timeSlotId });
              // Switch to upcoming tab after confirmation
              setActiveTab('upcoming');
            }}
          />
        </TabsContent>

        {/* Upcoming Tab - Enhanced with confirmed meetings */}
        <TabsContent value="upcoming" className="flex-1 overflow-y-auto m-0 min-h-0">
          <UpcomingMeetingsView />
        </TabsContent>
      </Tabs>
    </div>
  );
} 