/**
 * In-memory meeting storage
 * For production, replace with proper database (MongoDB, PostgreSQL, etc.)
 */

const MeetingProposal = require('../models/MeetingProposal');

class MeetingStore {
    constructor() {
        this.meetings = new Map(); // meetingId -> MeetingProposal
        this.userMeetings = new Map(); // userId -> Set of meetingIds
    }

    /**
     * Save a meeting proposal
     */
    save(meeting) {
        if (!(meeting instanceof MeetingProposal)) {
            throw new Error('Meeting must be an instance of MeetingProposal');
        }

        this.meetings.set(meeting.id, meeting);
        
        // Index by organizer
        if (!this.userMeetings.has(meeting.organizerId)) {
            this.userMeetings.set(meeting.organizerId, new Set());
        }
        this.userMeetings.get(meeting.organizerId).add(meeting.id);

        return meeting;
    }

    /**
     * Get a meeting by ID
     */
    getById(meetingId) {
        const meetingData = this.meetings.get(meetingId);
        return meetingData ? MeetingProposal.fromJSON(meetingData.toJSON()) : null;
    }

    /**
     * Get all meetings for a user
     */
    getUserMeetings(userId, status = null) {
        const userMeetingIds = this.userMeetings.get(userId);
        if (!userMeetingIds) {
            return [];
        }

        const meetings = Array.from(userMeetingIds)
            .map(id => this.getById(id))
            .filter(meeting => meeting !== null);

        if (status) {
            return meetings.filter(meeting => meeting.status === status);
        }

        return meetings;
    }

    /**
     * Get pending meetings for a user
     */
    getPendingMeetings(userId) {
        return this.getUserMeetings(userId, 'pending');
    }

    /**
     * Get confirmed meetings for a user
     */
    getConfirmedMeetings(userId) {
        return this.getUserMeetings(userId, 'confirmed');
    }

    /**
     * Update a meeting
     */
    update(meetingId, updateFn) {
        const meeting = this.getById(meetingId);
        if (!meeting) {
            throw new Error('Meeting not found');
        }

        updateFn(meeting);
        return this.save(meeting);
    }

    /**
     * Delete a meeting
     */
    delete(meetingId) {
        const meeting = this.getById(meetingId);
        if (!meeting) {
            return false;
        }

        this.meetings.delete(meetingId);
        
        // Remove from user index
        const userMeetingIds = this.userMeetings.get(meeting.organizerId);
        if (userMeetingIds) {
            userMeetingIds.delete(meetingId);
            if (userMeetingIds.size === 0) {
                this.userMeetings.delete(meeting.organizerId);
            }
        }

        return true;
    }

    /**
     * Find meeting by tracking token
     */
    findByTrackingToken(email, token) {
        for (const meeting of this.meetings.values()) {
            if (meeting.emailTrackingTokens[email] === token) {
                return MeetingProposal.fromJSON(meeting.toJSON());
            }
        }
        return null;
    }

    /**
     * Get statistics for debugging
     */
    getStats() {
        const statusCounts = {};
        let totalMeetings = 0;

        for (const meeting of this.meetings.values()) {
            totalMeetings++;
            statusCounts[meeting.status] = (statusCounts[meeting.status] || 0) + 1;
        }

        return {
            totalMeetings,
            statusCounts,
            totalUsers: this.userMeetings.size
        };
    }

    /**
     * Clear all data (for testing)
     */
    clear() {
        this.meetings.clear();
        this.userMeetings.clear();
    }

    /**
     * Get a meeting by ID (alias for getById for consistency)
     */
    get(meetingId) {
        return this.getById(meetingId);
    }

    /**
     * Upsert a meeting (update if exists, create if not)
     */
    upsert(meetingId, meetingData) {
        let meeting = this.getById(meetingId);
        
        if (meeting) {
            // Update existing meeting
            Object.assign(meeting, meetingData);
            return this.save(meeting);
        } else {
            // Create new meeting
            if (meetingData instanceof MeetingProposal) {
                return this.save(meetingData);
            } else {
                // Create MeetingProposal from data
                const newMeeting = new MeetingProposal(meetingData);
                newMeeting.id = meetingId;
                return this.save(newMeeting);
            }
        }
    }

    /**
     * Add a response from a participant
     * @param {string} pollId - The meeting/poll ID
     * @param {string} user - The user email or identifier
     * @param {string[]} slots - Array of selected slot IDs
     */
    addResponse(pollId, user, slots) {
        const meeting = this.getById(pollId);
        if (!meeting) {
            throw new Error('Meeting not found');
        }

        // Initialize responses object if it doesn't exist
        if (!meeting.responses) {
            meeting.responses = {};
        }

        // Store the user's selections (overwrites previous selections)
        meeting.responses[user] = {
            slots: slots,
            timestamp: new Date().toISOString()
        };

        // Save the updated meeting
        this.save(meeting);


        return meeting;
    }

    /**
     * Get response tallies for a meeting
     * @param {string} pollId - The meeting/poll ID
     * @returns {Object} Tallies object with bySlot counts and response details
     */
    tallies(pollId) {
        const meeting = this.getById(pollId);
        if (!meeting) {
            throw new Error('Meeting not found');
        }

        const responses = meeting.responses || {};
        const bySlot = {};
        const responseDetails = [];

        // Initialize all slots with 0 votes
        if (meeting.proposedTimeSlots) {
            meeting.proposedTimeSlots.forEach(slot => {
                bySlot[slot.id] = {
                    count: 0,
                    voters: [],
                    slotInfo: {
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        timezone: slot.timezone
                    }
                };
            });
        }

        // Count votes for each slot
        Object.entries(responses).forEach(([user, response]) => {
            responseDetails.push({
                user,
                slots: response.slots,
                timestamp: response.timestamp
            });

            response.slots.forEach(slotId => {
                if (bySlot[slotId]) {
                    bySlot[slotId].count++;
                    bySlot[slotId].voters.push(user);
                }
            });
        });

        // Calculate vital and optional participant counts
        const vitalResponded = new Set();
        const optionalResponded = new Set();

        Object.keys(responses).forEach(user => {
            const isVital = meeting.vitalParticipants.some(p => 
                p.email.toLowerCase() === user.toLowerCase()
            );
            const isOptional = meeting.optionalParticipants.some(p => 
                p.email.toLowerCase() === user.toLowerCase()
            );

            if (isVital) vitalResponded.add(user);
            if (isOptional) optionalResponded.add(user);
        });

        return {
            bySlot,
            responses: responseDetails,
            slots: meeting.proposedTimeSlots || [],
            stats: {
                totalResponses: Object.keys(responses).length,
                vitalResponded: vitalResponded.size,
                optionalResponded: optionalResponded.size,
                totalVital: meeting.vitalParticipants.length,
                totalOptional: meeting.optionalParticipants.length
            }
        };
    }
}

// Singleton instance
const meetingStore = new MeetingStore();

module.exports = meetingStore;