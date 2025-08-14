/**
 * Meeting Management Routes
 * Handles meeting-related API endpoints
 */

const express = require('express');
const router = express.Router();
const meetingStore = require('../storage/MeetingStore');

/**
 * GET /api/meetings/:id/responses
 * Get response tallies for a specific meeting
 */
router.get('/:id/responses', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get meeting to verify it exists and check authorization
        const meeting = meetingStore.getById(id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        
        // Check if user is the organizer
        if (meeting.organizerId !== req.user.oid) {
            return res.status(403).json({ error: 'Unauthorized - only organizer can view responses' });
        }
        
        // Get tallies from store
        const tallies = meetingStore.tallies(id);
        
        // Add meeting metadata to response
        const response = {
            meetingId: id,
            meetingTitle: meeting.title,
            status: meeting.status,
            totalVitalParticipants: meeting.vitalParticipants.length,
            totalOptionalParticipants: meeting.optionalParticipants.length,
            ...tallies
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('Error getting meeting responses:', error);
        res.status(500).json({ 
            error: 'Failed to get meeting responses',
            details: error.message 
        });
    }
});

/**
 * GET /api/meetings/:id
 * Get meeting details (useful for frontend to get meeting info)
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const meeting = meetingStore.getById(id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        
        // Check if user is the organizer or a participant
        const isOrganizer = meeting.organizerId === req.user.oid;
        const userEmail = req.user.preferred_username || req.user.email;
        const isParticipant = meeting.vitalParticipants.some(p => p.email === userEmail) ||
                             meeting.optionalParticipants.some(p => p.email === userEmail);
        
        if (!isOrganizer && !isParticipant) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Return meeting data (sensitive data like tracking tokens removed for non-organizers)
        const meetingData = meeting.toJSON();
        if (!isOrganizer) {
            delete meetingData.emailTrackingTokens;
            delete meetingData.responses;
        }
        
        res.json(meetingData);
        
    } catch (error) {
        console.error('Error getting meeting:', error);
        res.status(500).json({ 
            error: 'Failed to get meeting',
            details: error.message 
        });
    }
});

module.exports = router;