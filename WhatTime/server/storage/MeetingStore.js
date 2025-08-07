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
}

// Singleton instance
const meetingStore = new MeetingStore();

module.exports = meetingStore;