/**
 * Outlook Actionable Messages (OAM) Routes
 * Handles Adaptive Card submissions from Outlook emails
 */

const express = require('express');
const router = express.Router();
const meetingStore = require('../storage/MeetingStore');

/**
 * Verify OAM request authenticity
 * TODO: Implement proper DKIM/SPF/signed card verification for production
 * Reference: https://docs.microsoft.com/en-us/outlook/actionable-messages/security-requirements
 */
function verifyOAM(req) {
    // Placeholder for OAM verification
    // In production, verify:
    // 1. DKIM signature from Microsoft
    // 2. SPF record check
    // 3. Signed card validation
    // 4. Bearer token validation if using signed cards
    
    // For now, just check if the request has expected headers
    const authHeader = req.headers.authorization;
    const actionableMessageAuth = req.headers['ms-exchange-antispam-messagedata'];
    
    // Log for debugging
    console.log('OAM Request Headers:', {
        authorization: !!authHeader,
        'ms-exchange-antispam-messagedata': !!actionableMessageAuth,
        'user-agent': req.headers['user-agent']
    });
    
    // For development, allow all requests
    // TODO: Implement proper verification before production deployment
    return true;
}

/**
 * OPTIONS /api/oam/submit
 * Handle preflight requests for CORS
 */
router.options('/submit', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

/**
 * POST /api/oam/submit
 * Handle multi-select time slot submissions from Adaptive Cards
 */
router.post('/submit', async (req, res) => {
    // Set CORS headers for Actionable Messages
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    try {
        console.log('OAM submit request received:', {
            pollId: req.body.pollId,
            user: req.body.user,
            slotsType: typeof req.body.slots,
            userAgent: req.headers['user-agent']
        });
        
        // Verify OAM request
        if (!verifyOAM(req)) {
            console.error('OAM verification failed for request');
            return res.status(401).json({ error: 'Invalid OAM request' });
        }
        
        const { pollId, user, slots } = req.body;
        
        // Validate required fields
        if (!pollId || !user || !slots) {
            return res.status(400).json({ 
                error: 'Missing required fields: pollId, user, slots' 
            });
        }
        
        // Parse slots - could be comma-delimited string from {{times.value}}
        let slotArray = [];
        if (typeof slots === 'string') {
            slotArray = slots.split(',').map(s => s.trim()).filter(s => s);
        } else if (Array.isArray(slots)) {
            slotArray = slots;
        } else {
            return res.status(400).json({ 
                error: 'Invalid slots format. Expected string or array.' 
            });
        }
        
        // Store the response
        try {
            const meeting = meetingStore.addResponse(pollId, user, slotArray);
            console.log(`✅ OAM response stored successfully: ${user} selected ${slotArray.length} slots for meeting ${pollId}`);
        } catch (storeError) {
            console.error('❌ Error storing OAM response:', {
                pollId,
                user,
                slots: slotArray,
                error: storeError.message
            });
            return res.status(500).json({ 
                error: 'Failed to store response',
                details: storeError.message 
            });
        }
        
        // Return a small Adaptive Card acknowledgement
        // This replaces the original card inline in Outlook
        const acknowledgementCard = {
            type: "AdaptiveCard",
            version: "1.0",
            body: [
                {
                    type: "Container",
                    items: [
                        {
                            type: "TextBlock",
                            text: "✅ Thank you!",
                            size: "Large",
                            weight: "Bolder",
                            color: "Good",
                            horizontalAlignment: "Center"
                        },
                        {
                            type: "TextBlock",
                            text: "Your time preferences have been recorded.",
                            wrap: true,
                            horizontalAlignment: "Center"
                        },
                        {
                            type: "TextBlock",
                            text: `Selected ${slotArray.length} time slot${slotArray.length !== 1 ? 's' : ''}`,
                            size: "Small",
                            color: "Accent",
                            horizontalAlignment: "Center",
                            spacing: "Small"
                        }
                    ]
                }
            ],
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json"
        };
        
        // Send CARD response for Outlook to replace the original card
        res.json({
            statusCode: 200,
            type: "AdaptiveCard",
            value: acknowledgementCard
        });
        
    } catch (error) {
        console.error('OAM submit error:', error);
        
        // Return error card
        const errorCard = {
            type: "AdaptiveCard",
            version: "1.0",
            body: [
                {
                    type: "TextBlock",
                    text: "❌ Error",
                    size: "Large",
                    weight: "Bolder",
                    color: "Attention"
                },
                {
                    type: "TextBlock",
                    text: "Unable to record your response. Please try again or use the web link.",
                    wrap: true
                }
            ],
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json"
        };
        
        res.status(500).json({
            statusCode: 500,
            type: "AdaptiveCard",
            value: errorCard
        });
    }
});

module.exports = router;