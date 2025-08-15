/**
 * Meeting Proposal Model
 * Manages the lifecycle: proposed → pending → confirmed
 */

class MeetingProposal {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.organizerId = data.organizerId;
        this.title = data.title;
        this.location = data.location || '';
        this.duration = data.duration; // minutes
        this.timeZone = data.timeZone || 'UTC';
        this.description = data.description || '';
        
        // Meeting state
        this.status = data.status || 'proposed'; // proposed, pending, confirmed, cancelled
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        
        // Participants
        this.vitalParticipants = data.vitalParticipants || []; // Must attend for meeting to proceed
        this.optionalParticipants = data.optionalParticipants || []; // Nice to have but not required
        
        // Time proposals
        this.proposedTimeSlots = data.proposedTimeSlots || []; // Array of time options
        this.selectedTimeSlot = data.selectedTimeSlot || null; // Confirmed time slot
        
        // Response tracking
        this.responses = data.responses || {}; // email -> response data
        // Note: responseStats are now calculated dynamically via MeetingStore.getResponseStats()
        
        // Email tracking
        this.emailTrackingTokens = data.emailTrackingTokens || {}; // email -> unique token
        this.sentAt = data.sentAt || null;
        this.confirmedAt = data.confirmedAt || null;
    }

    generateId() {
        return 'meeting_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate unique tracking tokens for each vital participant
     */
    generateTrackingTokens() {
        this.emailTrackingTokens = {};
        this.vitalParticipants.forEach(participant => {
            this.emailTrackingTokens[participant.email] = this.generateTrackingToken(participant.email);
        });
        this.updatedAt = new Date().toISOString();
    }

    generateTrackingToken(email) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 16);
        return `${timestamp}_${random}_${Buffer.from(email).toString('base64').replace(/[+/=]/g, '')}`;
    }

    /**
     * Record a response from a participant
     */
    recordResponse(email, timeSlotId, token, metadata = {}) {
        // Verify token
        if (this.emailTrackingTokens[email] !== token) {
            throw new Error('Invalid tracking token');
        }

        this.responses[email] = {
            timeSlotId,
            respondedAt: new Date().toISOString(),
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            token: token
        };

        this.updatedAt = new Date().toISOString();
        
        return this.responses[email];
    }



    /**
     * Move to pending status and mark as sent
     */
    markAsPending() {
        this.status = 'pending';
        this.sentAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Confirm meeting with selected time slot
     */
    confirmMeeting(timeSlotId, outlookEventId = null, outlookWebLink = null) {
        const timeSlot = this.proposedTimeSlots.find(slot => slot.id === timeSlotId);
        if (!timeSlot) {
            throw new Error('Invalid time slot ID');
        }

        this.status = 'confirmed';
        this.selectedTimeSlot = timeSlot;
        this.confirmedAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        
        if (outlookEventId) {
            this.outlookEventId = outlookEventId;
        }
        
        if (outlookWebLink) {
            this.outlookWebLink = outlookWebLink;
        }
    }

    /**
     * Cancel the meeting
     */
    cancel(reason = '') {
        this.status = 'cancelled';
        this.cancellationReason = reason;
        this.cancelledAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Get all participants (vital + optional)
     */
    getAllParticipants() {
        return [...this.vitalParticipants, ...this.optionalParticipants];
    }

    /**
     * Get response tracking URL for a participant
     */
    getTrackingUrl(baseUrl, email, timeSlotId) {
        const token = this.emailTrackingTokens[email];
        if (!token) {
            throw new Error('No tracking token found for email');
        }
        
        return `${baseUrl}/api/meetings/${this.id}/respond?email=${encodeURIComponent(email)}&slot=${timeSlotId}&token=${token}`;
    }

    /**
     * Export for JSON storage
     */
    toJSON() {
        return {
            id: this.id,
            organizerId: this.organizerId,
            title: this.title,
            location: this.location,
            duration: this.duration,
            timeZone: this.timeZone,
            description: this.description,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            vitalParticipants: this.vitalParticipants,
            optionalParticipants: this.optionalParticipants,
            proposedTimeSlots: this.proposedTimeSlots,
            selectedTimeSlot: this.selectedTimeSlot,
            responses: this.responses,
            emailTrackingTokens: this.emailTrackingTokens,
            sentAt: this.sentAt,
            confirmedAt: this.confirmedAt,
            outlookEventId: this.outlookEventId,
            cancellationReason: this.cancellationReason,
            cancelledAt: this.cancelledAt
        };
    }

    /**
     * Create from stored JSON data
     */
    static fromJSON(data) {
        return new MeetingProposal(data);
    }
}

module.exports = MeetingProposal;