import React, { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  Mail, 
  Building, 
  Plus, 
  Trash2, 
  Star,
  UserCheck,
  ChevronDown,
  ChevronRight,
  Save,
  Edit3,
  Check,
  X
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "../../lib/utils";
import { authService, GraphUser } from "../services/authService";

interface Participant {
  id: string;
  email: string;
  name: string;
  type: 'internal' | 'external';
  priority: 'vital' | 'optional';
  department?: string;
  title?: string;
}

interface SavedGroup {
  id: string;
  name: string;
  participants: Participant[];
  createdAt: Date;
}

interface MeetingGroup {
  id: string;
  name: string;
  participants: Participant[];
  isExpanded: boolean;
  isEditing: boolean;
}

interface EnhancedParticipantManagerProps {
  onParticipantsChange: (participants: Participant[]) => void;
  className?: string;
}

export function EnhancedParticipantManager({ 
  onParticipantsChange, 
  className 
}: EnhancedParticipantManagerProps) {
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
  const [meetingGroups, setMeetingGroups] = useState<MeetingGroup[]>([]);
  const [isMainExpanded, setIsMainExpanded] = useState(true);

  // Load saved groups from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('meetingOptimizerGroups');
    if (saved) {
      try {
        const groups = JSON.parse(saved);
        setSavedGroups(groups);
      } catch (error) {
        console.error('Failed to load saved groups:', error);
      }
    }
  }, []);

  // Update parent with all participants when meeting groups change
  useEffect(() => {
    const allParticipants = meetingGroups.flatMap(group => group.participants);
    onParticipantsChange(allParticipants);
  }, [meetingGroups, onParticipantsChange]);

  const addNewGroup = () => {
    const newGroup: MeetingGroup = {
      id: Date.now().toString(),
      name: `Group ${meetingGroups.length + 1}`,
      participants: [],
      isExpanded: true,
      isEditing: false
    };
    setMeetingGroups([...meetingGroups, newGroup]);
  };

  const updateGroup = (groupId: string, updates: Partial<MeetingGroup>) => {
    setMeetingGroups(groups =>
      groups.map(group =>
        group.id === groupId ? { ...group, ...updates } : group
      )
    );
  };

  const removeGroup = (groupId: string) => {
    setMeetingGroups(groups => groups.filter(group => group.id !== groupId));
  };

  const addParticipantToGroup = (groupId: string, participant: Participant) => {
    // Check if participant already exists in any group
    const existsInAnyGroup = meetingGroups.some(group =>
      group.participants.some(p => p.email === participant.email)
    );
    
    if (existsInAnyGroup) return; // Silently ignore duplicates

    setMeetingGroups(groups =>
      groups.map(group =>
        group.id === groupId 
          ? { ...group, participants: [...group.participants, participant] }
          : group
      )
    );
  };

  const removeParticipantFromGroup = (groupId: string, participantId: string) => {
    setMeetingGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? { ...group, participants: group.participants.filter(p => p.id !== participantId) }
          : group
      )
    );
  };

  const toggleParticipantPriority = (groupId: string, participantId: string) => {
    setMeetingGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? {
              ...group,
              participants: group.participants.map(p =>
                p.id === participantId
                  ? { ...p, priority: p.priority === 'vital' ? 'optional' : 'vital' }
                  : p
              )
            }
          : group
      )
    );
  };

  const saveGroupToPermanentStorage = (groupId: string) => {
    const group = meetingGroups.find(g => g.id === groupId);
    if (!group || group.participants.length === 0) return;

    const savedGroup: SavedGroup = {
      id: Date.now().toString(),
      name: group.name,
      participants: [...group.participants],
      createdAt: new Date()
    };

    const updatedSavedGroups = [...savedGroups, savedGroup];
    setSavedGroups(updatedSavedGroups);
    localStorage.setItem('meetingOptimizerGroups', JSON.stringify(updatedSavedGroups));
  };

  const loadSavedGroupIntoMeeting = (groupId: string, savedGroupId: string) => {
    const savedGroup = savedGroups.find(g => g.id === savedGroupId);
    if (!savedGroup) return;

    setMeetingGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? { ...group, participants: [...savedGroup.participants] }
          : group
      )
    );
  };

  const deleteSavedGroup = (savedGroupId: string) => {
    const updatedGroups = savedGroups.filter(g => g.id !== savedGroupId);
    setSavedGroups(updatedGroups);
    localStorage.setItem('meetingOptimizerGroups', JSON.stringify(updatedGroups));
  };

  const totalParticipants = meetingGroups.reduce((sum, group) => sum + group.participants.length, 0);
  const totalVital = meetingGroups.reduce(
    (sum, group) => sum + group.participants.filter(p => p.priority === 'vital').length, 0
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Header with Collapse Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsMainExpanded(!isMainExpanded)}
          className="flex items-center gap-2 text-sm font-medium hover:bg-muted p-1 rounded"
        >
          {isMainExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span>Participant Groups</span>
        </button>
        <div className="text-xs text-muted-foreground">
          {totalParticipants} total • {totalVital} vital
        </div>
      </div>

      {/* Collapsible Content */}
      {isMainExpanded && (
        <div className="space-y-4">
          {/* Meeting Groups */}
          {meetingGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              savedGroups={savedGroups}
              onUpdateGroup={(updates) => updateGroup(group.id, updates)}
              onRemoveGroup={() => removeGroup(group.id)}
              onAddParticipant={(participant) => addParticipantToGroup(group.id, participant)}
              onRemoveParticipant={(participantId) => removeParticipantFromGroup(group.id, participantId)}
              onToggleParticipantPriority={(participantId) => toggleParticipantPriority(group.id, participantId)}
              onSaveGroup={() => saveGroupToPermanentStorage(group.id)}
              onLoadSavedGroup={(savedGroupId) => loadSavedGroupIntoMeeting(group.id, savedGroupId)}
              onDeleteSavedGroup={deleteSavedGroup}
            />
          ))}

          {/* Add Group Button */}
          <Button
            variant="outline"
            onClick={addNewGroup}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>

          {/* Empty State */}
          {meetingGroups.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2" />
              <p className="text-xs">No groups added yet</p>
              <p className="text-xs">Click "Add Group" to get started</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Group Card Component
interface GroupCardProps {
  group: MeetingGroup;
  savedGroups: SavedGroup[];
  onUpdateGroup: (updates: Partial<MeetingGroup>) => void;
  onRemoveGroup: () => void;
  onAddParticipant: (participant: Participant) => void;
  onRemoveParticipant: (participantId: string) => void;
  onToggleParticipantPriority: (participantId: string) => void;
  onSaveGroup: () => void;
  onLoadSavedGroup: (savedGroupId: string) => void;
  onDeleteSavedGroup: (savedGroupId: string) => void;
}

function GroupCard({
  group,
  savedGroups,
  onUpdateGroup,
  onRemoveGroup,
  onAddParticipant,
  onRemoveParticipant,
  onToggleParticipantPriority,
  onSaveGroup,
  onLoadSavedGroup,
  onDeleteSavedGroup
}: GroupCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GraphUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [externalEmail, setExternalEmail] = useState("");
  const [editingName, setEditingName] = useState(group.name);
  const [selectedSavedGroupId, setSelectedSavedGroupId] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState({
    vital: true,
    optional: true
  });

  // Search internal users
  useEffect(() => {
    const searchInternal = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const result = await authService.searchUsers(searchQuery, 10);
        setSearchResults(result.users || []);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchInternal, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const addInternalParticipant = (user: GraphUser, priority: 'vital' | 'optional' = 'optional') => {
    const newParticipant: Participant = {
      id: Date.now().toString(),
      email: user.mail,
      name: user.displayName,
      type: 'internal',
      priority,
      department: user.department,
      title: user.jobTitle
    };

    onAddParticipant(newParticipant);
    setSearchQuery("");
    setSearchResults([]);
  };

  const addExternalParticipant = (priority: 'vital' | 'optional' = 'optional') => {
    if (!externalEmail) return;

    const newParticipant: Participant = {
      id: Date.now().toString(),
      email: externalEmail,
      name: externalEmail.split('@')[0],
      type: 'external',
      priority
    };

    onAddParticipant(newParticipant);
    setExternalEmail("");
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const vitalParticipants = group.participants.filter(p => p.priority === 'vital');
  const optionalParticipants = group.participants.filter(p => p.priority === 'optional');

  return (
    <div className="border rounded-md">
      {/* Group Header */}
      <div className="flex items-center justify-between p-3 bg-muted/50">
        <div className="flex items-center gap-2">
          <button onClick={() => onUpdateGroup({ isExpanded: !group.isExpanded })}>
            {group.isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
          
          {group.isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-6 text-xs w-32"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => {
                  onUpdateGroup({ name: editingName, isEditing: false });
                }}
                className="h-6 px-2"
              >
                <Check className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <span className="text-sm font-medium">{group.name}</span>
          )}
          
          <div className="text-xs text-muted-foreground">
            {group.participants.length} people
            {vitalParticipants.length > 0 && ` • ${vitalParticipants.length} vital`}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!group.isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdateGroup({ isEditing: true })}
              className="h-6 px-2"
            >
              <Edit3 className="h-3 w-3" />
            </Button>
          )}
          
          {group.participants.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSaveGroup}
              className="h-6 px-2"
              title="Save group for future use"
            >
              <Save className="h-3 w-3" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemoveGroup}
            className="h-6 px-2"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Expanded Group Content */}
      {group.isExpanded && (
        <div className="p-3 space-y-3">
          {/* Load Saved Group */}
          <div className="flex gap-2">
            <select 
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background"
              value={selectedSavedGroupId}
              onChange={(e) => {
                setSelectedSavedGroupId(e.target.value);
                if (e.target.value) {
                  onLoadSavedGroup(e.target.value);
                }
              }}
            >
              <option value="">Load saved group...</option>
              {savedGroups.map((savedGroup) => (
                <option key={savedGroup.id} value={savedGroup.id}>
                  {savedGroup.name} ({savedGroup.participants.length} people)
                </option>
              ))}
            </select>
            
            {selectedSavedGroupId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onDeleteSavedGroup(selectedSavedGroupId);
                  setSelectedSavedGroupId("");
                }}
                className="px-2"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Add Participants Tabs */}
          <Tabs defaultValue="internal" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="internal" className="text-xs">
                <Building className="h-3 w-3 mr-1" />
                Internal
              </TabsTrigger>
              <TabsTrigger value="external" className="text-xs">
                <Mail className="h-3 w-3 mr-1" />
                External
              </TabsTrigger>
            </TabsList>

            {/* Internal Search */}
            <TabsContent value="internal" className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search colleagues by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 text-xs"
                />
              </div>
              
              {isSearching && (
                <div className="text-xs text-muted-foreground text-center py-2">Searching...</div>
              )}
              
              {searchResults.length > 0 && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{user.displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">{user.mail}</div>
                        {user.department && (
                          <div className="text-xs text-muted-foreground">{user.department}</div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => addInternalParticipant(user, 'vital')}
                        >
                          <Star className="h-2.5 w-2.5 mr-1" />
                          Vital
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => addInternalParticipant(user, 'optional')}
                        >
                          Optional
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* External Email */}
            <TabsContent value="external" className="space-y-2">
              <Input
                placeholder="External email address..."
                value={externalEmail}
                onChange={(e) => setExternalEmail(e.target.value)}
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => addExternalParticipant('vital')}
                  disabled={!externalEmail}
                >
                  <Star className="h-3 w-3 mr-1" />
                  Add as Vital
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => addExternalParticipant('optional')}
                  disabled={!externalEmail}
                >
                  Add as Optional
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Current Participants */}
          {group.participants.length > 0 && (
            <div className="space-y-2">
              {/* Vital Participants */}
              <div>
                <button
                  onClick={() => toggleSection('vital')}
                  className="flex items-center justify-between w-full p-2 text-left hover:bg-muted rounded-md"
                >
                  <div className="flex items-center gap-2">
                    {expandedSections.vital ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <Star className="h-3 w-3 text-amber-500" />
                    <span className="text-xs font-medium">Vital Participants ({vitalParticipants.length})</span>
                  </div>
                </button>
                
                {expandedSections.vital && vitalParticipants.length > 0 && (
                  <div className="space-y-1 ml-4">
                    {vitalParticipants.map((participant) => (
                      <ParticipantRow
                        key={participant.id}
                        participant={participant}
                        onRemove={() => onRemoveParticipant(participant.id)}
                        onTogglePriority={() => onToggleParticipantPriority(participant.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Participants */}
              <div>
                <button
                  onClick={() => toggleSection('optional')}
                  className="flex items-center justify-between w-full p-2 text-left hover:bg-muted rounded-md"
                >
                  <div className="flex items-center gap-2">
                    {expandedSections.optional ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <UserCheck className="h-3 w-3 text-blue-500" />
                    <span className="text-xs font-medium">Optional Participants ({optionalParticipants.length})</span>
                  </div>
                </button>
                
                {expandedSections.optional && optionalParticipants.length > 0 && (
                  <div className="space-y-1 ml-4">
                    {optionalParticipants.map((participant) => (
                      <ParticipantRow
                        key={participant.id}
                        participant={participant}
                        onRemove={() => onRemoveParticipant(participant.id)}
                        onTogglePriority={() => onToggleParticipantPriority(participant.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {group.participants.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Users className="h-6 w-6 mx-auto mb-1" />
              <p className="text-xs">No participants in this group</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Participant Row Component
interface ParticipantRowProps {
  participant: Participant;
  onRemove: () => void;
  onTogglePriority: () => void;
}

function ParticipantRow({ participant, onRemove, onTogglePriority }: ParticipantRowProps) {
  return (
    <div className="flex items-center justify-between p-2 border rounded-md bg-background">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={onTogglePriority}
          className="flex-shrink-0"
          title={`Mark as ${participant.priority === 'vital' ? 'optional' : 'vital'}`}
        >
          {participant.priority === 'vital' ? (
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
          ) : (
            <Star className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium truncate">{participant.name}</span>
            <span className={cn(
              "text-xs px-1 rounded",
              participant.type === 'internal' 
                ? "bg-blue-100 text-blue-700" 
                : "bg-gray-100 text-gray-700"
            )}>
              {participant.type}
            </span>
          </div>
          <div className="text-xs text-muted-foreground truncate">{participant.email}</div>
          {participant.title && (
            <div className="text-xs text-muted-foreground">{participant.title}</div>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 flex-shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export type { Participant }; 