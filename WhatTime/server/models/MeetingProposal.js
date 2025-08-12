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
        this.responseStats = data.responseStats || this.calculateResponseStats();
        
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

        this.responseStats = this.calculateResponseStats();
        this.updatedAt = new Date().toISOString();
        
        return this.responses[email];
    }

    /**
     * Calculate response statistics
     */
    calculateResponseStats() {
        const vitalEmails = this.vitalParticipants.map(p => p.email);
        const vitalResponses = Object.keys(this.responses).filter(email => vitalEmails.includes(email));
        
        const timeSlotCounts = {};
        const totalVital = vitalEmails.length;
        
        // Count responses per time slot
        this.proposedTimeSlots.forEach(slot => {
            timeSlotCounts[slot.id] = {
                count: 0,
                percentage: 0,
                respondents: []
            };
        });

        vitalResponses.forEach(email => {
            const response = this.responses[email];
            if (timeSlotCounts[response.timeSlotId]) {
                timeSlotCounts[response.timeSlotId].count++;
                timeSlotCounts[response.timeSlotId].respondents.push(email);
            }
        });

        // Calculate percentages
        Object.keys(timeSlotCounts).forEach(slotId => {
            const count = timeSlotCounts[slotId].count;
            timeSlotCounts[slotId].percentage = totalVital > 0 ? Math.round((count / totalVital) * 100) : 0;
        });

        return {
            totalVitalParticipants: totalVital,
            respondedCount: vitalResponses.length,
            responseRate: totalVital > 0 ? Math.round((vitalResponses.length / totalVital) * 100) : 0,
            timeSlotCounts,
            hasConsensus: this.checkConsensus(timeSlotCounts, totalVital),
            topChoice: this.getTopChoice(timeSlotCounts)
        };
    }

    /**
     * Check if we have enough consensus to proceed
     * Requires 70% of vital participants to agree on a time slot
     */
    checkConsensus(timeSlotCounts, totalVital) {
        const threshold = Math.ceil(totalVital * 0.7); // 70% consensus threshold
        return Object.values(timeSlotCounts).some(slot => slot.count >= threshold);
    }

    /**
     * Get the time slot with the most votes
     */
    getTopChoice(timeSlotCounts) {
        let topSlot = null;
        let maxCount = 0;

        Object.entries(timeSlotCounts).forEach(([slotId, data]) => {
            if (data.count > maxCount) {
                maxCount = data.count;
                topSlot = {
                    slotId,
                    count: data.count,
                    percentage: data.percentage,
                    respondents: data.respondents
                };
            }
        });

        return topSlot;
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
            responseStats: this.responseStats,
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