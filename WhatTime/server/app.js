const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
const port = process.env.PORT || 3001;

// Token cache with 1 hour TTL
const tokenCache = new NodeCache({ stdTTL: 3600 });

// Import meeting coordination modules
const MeetingProposal = require('./models/MeetingProposal');
const meetingStore = require('./storage/MeetingStore');
const { generateTimeSelectionEmail } = require('./templates/timeSelectionEmail');

// Import routes
const oamRoutes = require('./routes/oam');
const meetingsRoutes = require('./routes/meetings');

// CORS configuration
app.use(cors({
    origin: ['https://localhost:3000', 'https://outlook.office.com', 'https://outlook.office365.com'],
    credentials: true
}));

app.use(express.json());

// Azure AD configuration - these should be environment variables in production
const clientConfig = {
    auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        authority: 'https://login.microsoftonline.com/common'
    }
};

// Log configuration status (without secrets)
console.log('Azure AD Configuration:');
console.log('- Client ID present:', !!process.env.AZURE_CLIENT_ID);
console.log('- Client Secret present:', !!process.env.AZURE_CLIENT_SECRET);
console.log('- Client ID value:', process.env.AZURE_CLIENT_ID ? `${process.env.AZURE_CLIENT_ID.substring(0, 8)}...` : 'MISSING');
console.log('- PUBLIC_API_BASE:', process.env.PUBLIC_API_BASE || 'NOT SET');



if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    console.error('❌ CRITICAL: Missing Azure AD environment variables!');
    console.error('Please set AZURE_CLIENT_ID and AZURE_CLIENT_SECRET environment variables');
    console.error('The authentication flow will not work without these values');
}

const cca = new ConfidentialClientApplication(clientConfig);

// JWKS client for token validation
const client = jwksClient({
    jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
});

// Function to get signing key
function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

// Middleware to validate bootstrap token
const validateBootstrapToken = (req, res, next) => {
    console.log('Auth middleware called for:', req.method, req.path);
    const authHeader = req.headers.authorization;
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No valid authorization header found');
        return res.status(401).json({ error: 'No valid authorization header found' });
    }

    const token = authHeader.substring(7);
    
    jwt.verify(token, getKey, {
        audience: clientConfig.auth.clientId,
        issuer: /^https:\/\/login\.microsoftonline\.com\/.*\/v2\.0$/
    }, (err, decoded) => {
        if (err) {
            console.error('❌ Token validation failed:');
            console.error('- Error type:', err.name);
            console.error('- Error message:', err.message);
            console.error('- Expected audience:', clientConfig.auth.clientId);
            console.error('- Token length:', token.length);
            console.error('- Token preview:', token.substring(0, 50) + '...');
            return res.status(401).json({ 
                error: 'Invalid token',
                details: err.message,
                errorType: err.name
            });
        }
        
        console.log('✅ Token validation successful for user:', decoded.oid || decoded.sub);
        req.user = decoded;
        req.bootstrapToken = token;
        next();
    });
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Meeting Optimizer API is running' });
});

// Test endpoint to verify server is running
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'Server is running',
        timestamp: new Date().toISOString(),
        endpoints: {
            'POST /api/meetings/create': 'Create meeting proposal',
            'GET /api/meetings': 'List meetings',
            'POST /api/meetings/:id/send-proposals': 'Send proposals'
        }
    });
});

// Exchange bootstrap token for Microsoft Graph access token
app.post('/api/auth/token', validateBootstrapToken, async (req, res) => {
    try {
        const { scopes } = req.body;
        const defaultScopes = [
            'https://graph.microsoft.com/Calendars.ReadWrite',
            'https://graph.microsoft.com/Calendars.Read.Shared',
            'https://graph.microsoft.com/User.Read',
            'https://graph.microsoft.com/User.Read.All',
            'https://graph.microsoft.com/Mail.Send',
            'https://graph.microsoft.com/email',
            'https://graph.microsoft.com/openid',
            'https://graph.microsoft.com/profile',
            'https://graph.microsoft.com/offline_access'
        ];

        const requestedScopes = scopes || defaultScopes;

        // Check cache first
        const cacheKey = `${req.user.oid}_${requestedScopes.join(',')}`;
        const cachedToken = tokenCache.get(cacheKey);
        
        if (cachedToken) {
            return res.json({ 
                accessToken: cachedToken.accessToken,
                cached: true 
            });
        }

        // Perform "on behalf of" flow
        const oboRequest = {
            oboAssertion: req.bootstrapToken,
            scopes: requestedScopes,
        };

        const response = await cca.acquireTokenOnBehalfOf(oboRequest);
        
        if (response) {
            // Cache the token
            tokenCache.set(cacheKey, {
                accessToken: response.accessToken,
                expiresOn: response.expiresOn
            });

            res.json({ 
                accessToken: response.accessToken,
                expiresOn: response.expiresOn,
                scopes: response.scopes
            });
        } else {
            throw new Error('Failed to acquire token');
        }

    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ 
            error: 'Token exchange failed', 
            details: error.message 
        });
    }
});

// Get user's calendar events
app.get('/api/calendar/events', validateBootstrapToken, async (req, res) => {
    try {
        // Get access token for Microsoft Graph
        const tokenResponse = await axios.post(`http://localhost:${port}/api/auth/token`, 
            { scopes: ['https://graph.microsoft.com/Calendars.ReadWrite', 'https://graph.microsoft.com/Calendars.Read.Shared'] },
            { 
                headers: { 
                    'Authorization': `Bearer ${req.bootstrapToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const accessToken = tokenResponse.data.accessToken;

        // Query Microsoft Graph for calendar events
        const { startTime, endTime } = req.query;
        let graphUrl = 'https://graph.microsoft.com/v1.0/me/calendarview';
        
        if (startTime && endTime) {
            graphUrl += `?startDateTime=${startTime}&endDateTime=${endTime}`;
        } else {
            // Default to next 7 days
            const start = new Date().toISOString();
            const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            graphUrl += `?startDateTime=${start}&endDateTime=${end}`;
        }

        const graphResponse = await axios.get(graphUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({
            events: graphResponse.data.value,
            count: graphResponse.data.value.length
        });

    } catch (error) {
        console.error('Calendar events error:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve calendar events', 
            details: error.response?.data || error.message 
        });
    }
});

// Get user profile
app.get('/api/user/profile', validateBootstrapToken, async (req, res) => {
    try {
        const tokenResponse = await axios.post(`http://localhost:${port}/api/auth/token`, 
            { scopes: ['https://graph.microsoft.com/User.Read'] },
            { 
                headers: { 
                    'Authorization': `Bearer ${req.bootstrapToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const accessToken = tokenResponse.data.accessToken;

        const graphResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(graphResponse.data);

    } catch (error) {
        console.error('User profile error:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve user profile', 
            details: error.response?.data || error.message 
        });
    }
});

// Meeting optimization endpoint (placeholder for future implementation)
app.post('/api/meetings/optimize', validateBootstrapToken, async (req, res) => {
    try {
        const { attendees, duration, preferredTimes } = req.body;
        
        // This is where the meeting optimization logic would go
        // For now, return a simple response
        res.json({
            message: 'Meeting optimization functionality will be implemented here',
            attendees: attendees || [],
            duration: duration || 60,
            preferredTimes: preferredTimes || [],
            optimizedSuggestions: [
                {
                    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + (duration || 60) * 60 * 1000).toISOString(),
                    score: 95,
                    reason: 'All attendees available, optimal time zone coverage'
                }
            ]
        });

    } catch (error) {
        console.error('Meeting optimization error:', error);
        res.status(500).json({ 
            error: 'Meeting optimization failed', 
            details: error.message 
        });
    }
});

// ================================
// ENHANCED MEETING COORDINATION API
// ================================


// Create a new meeting proposal
app.post('/api/meetings/create', validateBootstrapToken, async (req, res) => {
    console.log('Meeting creation request received:', req.body);
    try {
        const { 
            title, 
            location, 
            duration, 
            timeZone, 
            description,
            vitalParticipants, 
            optionalParticipants, 
            proposedTimeSlots 
        } = req.body;

        // Validation
        if (!title || !duration || !vitalParticipants || !proposedTimeSlots) {
            return res.status(400).json({ 
                error: 'Missing required fields: title, duration, vitalParticipants, proposedTimeSlots' 
            });
        }

        if (vitalParticipants.length === 0) {
            return res.status(400).json({ 
                error: 'At least one vital participant is required' 
            });
        }

        if (proposedTimeSlots.length === 0) {
            return res.status(400).json({ 
                error: 'At least one time slot proposal is required' 
            });
        }

        // Create meeting proposal
        const meeting = new MeetingProposal({
            organizerId: req.user.oid,
            title,
            location: location || '',
            duration: parseInt(duration),
            timeZone: timeZone || 'UTC',
            description: description || '',
            vitalParticipants: vitalParticipants.map(p => ({
                email: p.email.toLowerCase().trim(),
                name: p.name || p.email.split('@')[0],
                priority: 'vital'
            })),
            optionalParticipants: (optionalParticipants || []).map(p => ({
                email: p.email.toLowerCase().trim(),
                name: p.name || p.email.split('@')[0],
                priority: 'optional'
            })),
            proposedTimeSlots: proposedTimeSlots.map((slot, index) => ({
                id: `slot_${index + 1}_${Date.now()}`,
                startTime: slot.startTime,
                endTime: slot.endTime,
                timezone: timeZone || 'UTC'
            }))
        });

        // Generate tracking tokens for vital participants
        meeting.generateTrackingTokens();

        // Save to store
        meetingStore.save(meeting);

        res.json({
            success: true,
            meetingId: meeting.id,
            status: meeting.status,
            message: 'Meeting proposal created successfully'
        });

    } catch (error) {
        console.error('Meeting creation error:', error);
        res.status(500).json({ 
            error: 'Failed to create meeting proposal', 
            details: error.message 
        });
    }
});



// Send time selection emails to vital participants
app.post('/api/meetings/:meetingId/send-proposals', validateBootstrapToken, async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { baseUrl } = req.body; // Frontend should provide the base URL

        const meeting = meetingStore.getById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        if (meeting.organizerId !== req.user.oid) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (meeting.status !== 'proposed') {
            return res.status(400).json({ 
                error: `Cannot send proposals for meeting with status: ${meeting.status}` 
            });
        }

        const emailResults = [];
        // Use PUBLIC_API_BASE if available, otherwise baseUrl from request, otherwise localhost
        const actualBaseUrl = process.env.PUBLIC_API_BASE || baseUrl || `http://localhost:${port}`;

        // Get access token for Microsoft Graph to send emails
        const tokenResponse = await axios.post(`http://localhost:${port}/api/auth/token`, 
            { scopes: ['https://graph.microsoft.com/Mail.Send'] },
            { 
                headers: { 
                    'Authorization': `Bearer ${req.bootstrapToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const accessToken = tokenResponse.data.accessToken;

        // Generate and send emails for vital participants
        for (const participant of meeting.vitalParticipants) {
            try {

                const emailContent = generateTimeSelectionEmail(meeting, participant.email, actualBaseUrl);
                
                if (!emailContent) {
                    throw new Error('Failed to generate email content');
                }
                
                console.log(`\n=== SENDING EMAIL TO ${participant.email} ===`);
                console.log('Subject:', `Time Selection Required: ${meeting.title}`);
                
                // Send email via Microsoft Graph
                const emailSent = await sendEmailViaGraph(
                    accessToken,
                    participant.email,
                    `Time Selection Required: ${meeting.title}`,
                    emailContent.html,
                    emailContent.plainText
                );

                if (emailSent.success) {
                    console.log(`✅ Email sent successfully to ${participant.email}`);
                    emailResults.push({
                        email: participant.email,
                        status: 'sent',
                        trackingToken: meeting.emailTrackingTokens[participant.email],
                        messageId: emailSent.messageId
                    });
                } else {
                    throw new Error(emailSent.error);
                }

            } catch (emailError) {
                console.error(`❌ Failed to send email to ${participant.email}:`, emailError);
                emailResults.push({
                    email: participant.email,
                    status: 'failed',
                    error: emailError.message
                });
            }
        }

        // Update meeting status to pending
        meetingStore.update(meetingId, (meeting) => {
            meeting.markAsPending();
        });

        res.json({
            success: true,
            meetingId: meeting.id,
            status: 'pending',
            emailResults,
            message: 'Time selection emails sent to vital participants'
        });

    } catch (error) {
        console.error('Send proposals error:', error);
        res.status(500).json({ 
            error: 'Failed to send meeting proposals', 
            details: error.message 
        });
    }
});

// [REMOVED] HTML response handling - replaced by Adaptive Cards
app.get('/api/meetings/:meetingId/respond', async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { email, slot, token } = req.query;

        if (!email || !slot || !token) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const meeting = meetingStore.getById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        if (meeting.status !== 'pending') {
            return res.status(400).json({ 
                error: 'Meeting is no longer accepting responses' 
            });
        }

        // Record the response
        const metadata = {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        };

        meetingStore.update(meetingId, (meeting) => {
            meeting.recordResponse(email, slot, token, metadata);
        });

        // Return success page HTML
        const updatedMeeting = meetingStore.getById(meetingId);
        const selectedSlot = updatedMeeting.proposedTimeSlots.find(s => s.id === slot);
        const startDate = new Date(selectedSlot.startTime);
        const endDate = new Date(selectedSlot.endTime);
        
        const successHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Response Recorded</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px 20px; background: #f8f9fa; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .success-icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #1f2937; margin: 0 0 16px 0; }
        p { color: #6b7280; margin: 0 0 24px 0; line-height: 1.5; }
        .selected-time { background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 24px 0; }
        .time-details { font-weight: 600; color: #1f2937; font-size: 18px; }
        .meeting-title { color: #3b82f6; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>Thank You!</h1>
        <p>Your time preference has been recorded for <span class="meeting-title">"${updatedMeeting.title}"</span></p>
        
        <div class="selected-time">
            <div class="time-details">
                ${startDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                })}
            </div>
            <div style="color: #6b7280; margin-top: 8px;">
                ${startDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    hour12: true 
                })} - ${endDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    hour12: true 
                })}
            </div>
        </div>

        <p>The organizer will send the final meeting invite once all participants have responded.</p>
        
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #9ca3af;">
            Response recorded at ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>
        `;

        res.setHeader('Content-Type', 'text/html');
        res.send(successHtml);

    } catch (error) {
        console.error('Response recording error:', error);
        
        const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Response Error</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px 20px; background: #f8f9fa; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .error-icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #dc2626; margin: 0 0 16px 0; }
        p { color: #6b7280; margin: 0 0 24px 0; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">❌</div>
        <h1>Response Error</h1>
        <p>Sorry, we couldn't record your response. This might be because:</p>
        <ul style="text-align: left; color: #6b7280;">
            <li>The link has expired or been used already</li>
            <li>The meeting is no longer accepting responses</li>
            <li>There was a technical issue</li>
        </ul>
        <p>Please contact the meeting organizer for assistance.</p>
    </div>
</body>
</html>
        `;

        res.status(500).setHeader('Content-Type', 'text/html');
        res.send(errorHtml);
    }
});

// Get meeting details and response status
app.get('/api/meetings/:meetingId', validateBootstrapToken, async (req, res) => {
    try {
        const { meetingId } = req.params;
        
        const meeting = meetingStore.getById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Only organizer can view full details
        if (meeting.organizerId !== req.user.oid) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        res.json({
            success: true,
            meeting: {
                id: meeting.id,
                title: meeting.title,
                location: meeting.location,
                duration: meeting.duration,
                status: meeting.status,
                createdAt: meeting.createdAt,
                sentAt: meeting.sentAt,
                confirmedAt: meeting.confirmedAt,
                vitalParticipants: meeting.vitalParticipants,
                optionalParticipants: meeting.optionalParticipants,
                proposedTimeSlots: meeting.proposedTimeSlots,
                selectedTimeSlot: meeting.selectedTimeSlot,
                outlookWebLink: meeting.outlookWebLink,
                responseStats: meeting.responseStats,
                responses: Object.keys(meeting.responses).map(email => ({
                    email,
                    timeSlotId: meeting.responses[email].timeSlotId,
                    respondedAt: meeting.responses[email].respondedAt
                }))
            }
        });

    } catch (error) {
        console.error('Get meeting error:', error);
        res.status(500).json({ 
            error: 'Failed to get meeting details', 
            details: error.message 
        });
    }
});

// Get all meetings for current user
app.get('/api/meetings', validateBootstrapToken, async (req, res) => {
    try {
        const { status } = req.query;
        
        const meetings = meetingStore.getUserMeetings(req.user.oid, status);
        
        // Return simplified meeting list
        const meetingList = meetings.map(meeting => ({
            id: meeting.id,
            title: meeting.title,
            status: meeting.status,
            createdAt: meeting.createdAt,
            sentAt: meeting.sentAt,
            confirmedAt: meeting.confirmedAt,
            vitalCount: meeting.vitalParticipants.length,
            optionalCount: meeting.optionalParticipants.length,
            responseStats: meeting.responseStats
        }));

        res.json({
            success: true,
            meetings: meetingList
        });

    } catch (error) {
        console.error('Get meetings error:', error);
        res.status(500).json({ 
            error: 'Failed to get meetings', 
            details: error.message 
        });
    }
});

// [REMOVED] Email tracking pixel - no longer needed
app.get('/api/meetings/:meetingId/track/open', async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { email, token } = req.query;

        // Log email open (in production, you'd store this)
        console.log(`Email opened: ${email} for meeting ${meetingId} at ${new Date().toISOString()}`);

        // Return 1x1 transparent pixel
        const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
        
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', pixel.length);
        res.setHeader('Cache-Control', 'no-cache');
        res.send(pixel);

    } catch (error) {
        console.error('Email tracking error:', error);
        res.status(200).send(''); // Don't break email rendering
    }
});

// Confirm meeting and send Outlook invites
app.post('/api/meetings/:meetingId/confirm', validateBootstrapToken, async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { timeSlotId } = req.body;

        const meeting = meetingStore.getById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        if (meeting.organizerId !== req.user.oid) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (meeting.status !== 'pending') {
            return res.status(400).json({ 
                error: `Cannot confirm meeting with status: ${meeting.status}` 
            });
        }

        if (!timeSlotId) {
            return res.status(400).json({ error: 'Time slot ID is required' });
        }

        const selectedSlot = meeting.proposedTimeSlots.find(slot => slot.id === timeSlotId);
        if (!selectedSlot) {
            return res.status(400).json({ error: 'Invalid time slot ID' });
        }

        console.log('🔄 Preparing meeting data for Outlook compose dialog...');

        // Prepare the meeting data for Outlook compose dialog
        const allParticipants = [
            ...meeting.vitalParticipants,
            ...meeting.optionalParticipants
        ];

        const meetingData = {
            title: meeting.title,
            location: meeting.location || '',
            description: `This meeting was coordinated through WhatTime Meeting Optimizer.\n\nDuration: ${meeting.duration} minutes`,
            startTime: selectedSlot.startTime,
            endTime: selectedSlot.endTime,
            attendees: allParticipants.map(p => ({
                email: p.email,
                name: p.name,
                type: 'required'
            }))
        };

        // Update meeting status to confirmed (but without Outlook event ID yet)
        meetingStore.update(meetingId, (meeting) => {
            meeting.confirmMeeting(timeSlotId, null, null);
        });

        const updatedMeeting = meetingStore.getById(meetingId);

        console.log(`✅ Meeting confirmed! Outlook compose dialog data prepared.`);
        console.log(`📧 Attendees: ${allParticipants.map(p => p.email).join(', ')}`);

        res.json({
            success: true,
            meetingId: meeting.id,
            status: 'confirmed',
            selectedTimeSlot: updatedMeeting.selectedTimeSlot,
            meetingData: meetingData,
            message: 'Meeting confirmed - opening Outlook compose dialog'
        });

    } catch (error) {
        console.error('Meeting confirmation error:', error);
        res.status(500).json({ 
            error: 'Failed to confirm meeting', 
            details: error.message 
        });
    }
});

// Helper function to send emails via Microsoft Graph
async function sendEmailViaGraph(accessToken, recipientEmail, subject, htmlContent, textContent) {
    try {
        const emailMessage = {
            message: {
                subject: subject,
                body: {
                    contentType: 'HTML',
                    content: htmlContent
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: recipientEmail
                        }
                    }
                ],
                importance: 'normal'
            },
            saveToSentItems: true
        };

        const response = await axios.post('https://graph.microsoft.com/v1.0/me/sendMail', emailMessage, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return {
            success: true,
            messageId: response.headers['request-id'] || 'sent'
        };

    } catch (error) {
        console.error('Microsoft Graph email error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
}

// Helper function to create Outlook calendar event via Microsoft Graph
async function createOutlookEvent(accessToken, meeting, selectedTimeSlot) {
    try {
        // Combine all participants (vital + optional) for the final meeting
        const allParticipants = [
            ...meeting.vitalParticipants,
            ...meeting.optionalParticipants
        ];

        // Convert time slot to proper DateTime format
        const startDateTime = new Date(selectedTimeSlot.startTime).toISOString();
        const endDateTime = new Date(selectedTimeSlot.endTime).toISOString();

        const calendarEvent = {
            subject: meeting.title,
            body: {
                contentType: 'HTML',
                content: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                        <h2 style="color: #2563eb; margin-bottom: 16px;">${meeting.title}</h2>
                        ${meeting.description ? `<p style="margin-bottom: 16px;">${meeting.description}</p>` : ''}
                        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                            <h3 style="margin: 0 0 8px 0; color: #374151;">Meeting Details</h3>
                            <p style="margin: 0;"><strong>Duration:</strong> ${meeting.duration} minutes</p>
                            ${meeting.location ? `<p style="margin: 0;"><strong>Location:</strong> ${meeting.location}</p>` : ''}
                        </div>
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">
                            This meeting was coordinated through WhatTime Meeting Optimizer.
                        </p>
                    </div>
                `
            },
            start: {
                dateTime: startDateTime,
                timeZone: selectedTimeSlot.timezone || 'UTC'
            },
            end: {
                dateTime: endDateTime,
                timeZone: selectedTimeSlot.timezone || 'UTC'
            },
            location: meeting.location ? {
                displayName: meeting.location
            } : null,
            attendees: allParticipants.map(participant => ({
                emailAddress: {
                    address: participant.email,
                    name: participant.name
                },
                type: 'required'
            })),
            allowNewTimeProposals: false,
            importance: 'normal',
            showAs: 'busy',
            reminderMinutesBeforeStart: 15,
            isOrganizer: true,
            responseRequested: true
        };

        // Remove null location if not provided
        if (!meeting.location) {
            delete calendarEvent.location;
        }

        console.log(`🗓️ Creating Outlook event: ${meeting.title}`);
        console.log(`⏰ Time: ${startDateTime} - ${endDateTime}`);
        console.log(`👥 Attendees: ${allParticipants.length} participants`);
        console.log('📧 Attendee emails:', allParticipants.map(p => p.email).join(', '));

        // Create the calendar event (this should automatically send invites)
        const response = await axios.post('https://graph.microsoft.com/v1.0/me/calendar/events', calendarEvent, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const eventData = response.data;

        console.log(`✅ Calendar event created successfully!`);
        console.log(`📅 Event ID: ${eventData.id}`);
        console.log(`🔗 Web Link: ${eventData.webLink}`);
        console.log(`📬 Invites should be sent automatically by Outlook`);

        // Manual backup: Send invitation emails if automatic sending fails
        try {
            for (const participant of allParticipants) {
                const inviteEmailContent = generateMeetingInviteEmail(meeting, selectedTimeSlot, eventData.webLink, participant.email);
                
                const emailSent = await sendEmailViaGraph(
                    accessToken,
                    participant.email,
                    `Meeting Invitation: ${meeting.title}`,
                    inviteEmailContent.html,
                    inviteEmailContent.plainText
                );

                if (emailSent.success) {
                    console.log(`📧 Manual invite sent to: ${participant.email}`);
                } else {
                    console.log(`⚠️ Failed to send manual invite to: ${participant.email}`);
                }
            }
        } catch (emailError) {
            console.log(`⚠️ Manual email sending failed (calendar event still created):`, emailError.message);
        }

        return {
            success: true,
            eventId: eventData.id,
            webLink: eventData.webLink,
            outlookUrl: `https://outlook.office.com/calendar/item/${eventData.id}`
        };

    } catch (error) {
        console.error('Microsoft Graph calendar error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
}

// Helper function to generate meeting invitation email content
function generateMeetingInviteEmail(meeting, selectedTimeSlot, outlookWebLink, recipientEmail) {
    const startDateTime = new Date(selectedTimeSlot.startTime);
    const endDateTime = new Date(selectedTimeSlot.endTime);
    
    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    };
    
    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
        });
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Invitation: ${meeting.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin: 0;">📅 Meeting Invitation</h1>
        <p style="color: #6b7280; margin: 8px 0 0 0;">You're invited to join this meeting</p>
    </div>

    <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 16px 0;">${meeting.title}</h2>
        
        <div style="margin-bottom: 16px;">
            <strong style="color: #374151;">📅 Date:</strong> ${formatDate(startDateTime)}
        </div>
        
        <div style="margin-bottom: 16px;">
            <strong style="color: #374151;">⏰ Time:</strong> ${formatTime(startDateTime)} - ${formatTime(endDateTime)}
        </div>
        
        <div style="margin-bottom: 16px;">
            <strong style="color: #374151;">⏱️ Duration:</strong> ${meeting.duration} minutes
        </div>
        
        ${meeting.location ? `
        <div style="margin-bottom: 16px;">
            <strong style="color: #374151;">📍 Location:</strong> ${meeting.location}
        </div>
        ` : ''}
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
        <a href="${outlookWebLink}" 
           style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
            📅 View in Outlook Calendar
        </a>
    </div>

    <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; border-left: 4px solid #2563eb; margin-bottom: 24px;">
        <h3 style="color: #1e40af; margin: 0 0 8px 0;">Meeting Details</h3>
        <p style="margin: 0; color: #1e40af;">This meeting was coordinated through WhatTime Meeting Optimizer to find the best time for all participants.</p>
    </div>

    <div style="text-align: center; color: #6b7280; font-size: 14px;">
        <p>If you can't attend, please respond directly through Outlook Calendar.</p>
        <p style="margin: 16px 0 0 0;">Powered by WhatTime Meeting Optimizer</p>
    </div>

</body>
</html>
    `;

    const plainText = `
Meeting Invitation: ${meeting.title}

Date: ${formatDate(startDateTime)}
Time: ${formatTime(startDateTime)} - ${formatTime(endDateTime)}
Duration: ${meeting.duration} minutes
${meeting.location ? `Location: ${meeting.location}` : ''}

View in Outlook: ${outlookWebLink}

This meeting was coordinated through WhatTime Meeting Optimizer.

If you can't attend, please respond directly through Outlook Calendar.
    `.trim();

    return { html, plainText };
}

// Search organization users - Microsoft Graph integration
app.post('/api/users/search', validateBootstrapToken, async (req, res) => {
    try {
        const { query, limit = 10 } = req.body;
        
        if (!query || query.trim().length < 2) {
            return res.json({ users: [], totalCount: 0 });
        }

        // Get access token for Microsoft Graph
        const tokenResponse = await axios.post(`http://localhost:${port}/api/auth/token`, 
            { scopes: ['https://graph.microsoft.com/User.Read.All'] },
            { 
                headers: { 
                    'Authorization': `Bearer ${req.bootstrapToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const accessToken = tokenResponse.data.accessToken;

        // Search users in your organization using Microsoft Graph
        const searchQuery = encodeURIComponent(query.trim());
        const graphUrl = `https://graph.microsoft.com/v1.0/users?$search="displayName:${searchQuery}" OR "mail:${searchQuery}"&$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation&$top=${limit}&$count=true`;

        const graphResponse = await axios.get(graphUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'ConsistencyLevel': 'eventual'  // Required for $search and $count
            }
        });

        res.json({
            users: graphResponse.data.value || [],
            totalCount: graphResponse.data['@odata.count'] || graphResponse.data.value?.length || 0
        });

    } catch (error) {
        console.error('User search error:', error);
        
        // If search fails, try filter instead (fallback)
        if (error.response?.status === 400) {
            try {
                const { query, limit = 10 } = req.body;
                const tokenResponse = await axios.post(`http://localhost:${port}/api/auth/token`, 
                    { scopes: ['https://graph.microsoft.com/User.Read.All'] },
                    { headers: { 'Authorization': `Bearer ${req.bootstrapToken}` }}
                );

                const accessToken = tokenResponse.data.accessToken;
                const searchQuery = encodeURIComponent(query.trim());
                const graphUrl = `https://graph.microsoft.com/v1.0/users?$filter=startswith(displayName,'${searchQuery}') or startswith(mail,'${searchQuery}')&$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation&$top=${limit}`;

                const graphResponse = await axios.get(graphUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                return res.json({
                    users: graphResponse.data.value || [],
                    totalCount: graphResponse.data.value?.length || 0
                });
            } catch (fallbackError) {
                console.error('Fallback search also failed:', fallbackError);
            }
        }

        res.status(500).json({ 
            error: 'User search failed', 
            details: error.response?.data?.error || error.message 
        });
    }
});

// Get users by emails (for team groups)
app.post('/api/users/by-emails', validateBootstrapToken, async (req, res) => {
    try {
        const { emails } = req.body;
        
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.json({ users: [] });
        }

        // Get access token for Microsoft Graph
        const tokenResponse = await axios.post(`http://localhost:${port}/api/auth/token`, 
            { scopes: ['https://graph.microsoft.com/User.Read.All'] },
            { 
                headers: { 
                    'Authorization': `Bearer ${req.bootstrapToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const accessToken = tokenResponse.data.accessToken;
        
        // Get users by their emails
        const users = [];
        for (const email of emails.slice(0, 20)) { // Limit to 20 users to avoid rate limits
            try {
                const graphResponse = await axios.get(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                users.push(graphResponse.data);
            } catch (userError) {
                console.warn(`User not found or inaccessible: ${email}`, userError.response?.status);
                // Continue with other users
            }
        }

        res.json({ users });

    } catch (error) {
        console.error('Get users by emails error:', error);
        res.status(500).json({ 
            error: 'Failed to get users by emails', 
            details: error.response?.data?.error || error.message 
        });
    }
});

// Get free/busy data for multiple users
app.post('/api/calendar/freebusy', validateBootstrapToken, async (req, res) => {
    try {
        const { emails, startTime, endTime } = req.body;
        
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.json({ freeBusyData: [] });
        }

        if (!startTime || !endTime) {
            return res.status(400).json({ error: 'startTime and endTime are required' });
        }

        // Get access token for Microsoft Graph
        const tokenResponse = await axios.post(`http://localhost:${port}/api/auth/token`, 
            { scopes: ['https://graph.microsoft.com/Calendars.ReadWrite', 'https://graph.microsoft.com/Calendars.Read.Shared'] },
            { 
                headers: { 
                    'Authorization': `Bearer ${req.bootstrapToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const accessToken = tokenResponse.data.accessToken;

        // Prepare the request for Microsoft Graph getSchedule
        const scheduleRequest = {
            schedules: emails.slice(0, 20), // Limit to 20 users
            startTime: {
                dateTime: startTime,
                timeZone: 'UTC'
            },
            endTime: {
                dateTime: endTime,
                timeZone: 'UTC'
            },
            availabilityViewInterval: 60 // 60 minutes
        };

        const graphResponse = await axios.post('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', scheduleRequest, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Transform the response to match frontend expectations
        const freeBusyData = graphResponse.data.value.map((schedule, index) => ({
            email: emails[index],
            freeBusy: schedule.busyViewEntries?.map(entry => ({
                start: entry.start,
                end: entry.end,
                status: entry.status === '2' ? 'busy' : 'free' // Graph returns status as string numbers
            })) || [],
            availabilityView: schedule.availabilityView || []
        }));

        res.json({ freeBusyData });

    } catch (error) {
        console.error('Free/busy data error:', error);
        res.status(500).json({ 
            error: 'Failed to get free/busy data', 
            details: error.response?.data?.error || error.message 
        });
    }
});

// Advanced availability analysis endpoint
app.post('/api/calendar/availability', validateBootstrapToken, async (req, res) => {
    try {
        const { attendees, startTime, endTime, duration, timeZone = 'UTC', constraints } = req.body;
        
        if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
            return res.status(400).json({ error: 'attendees array is required' });
        }

        if (!startTime || !endTime) {
            return res.status(400).json({ error: 'startTime and endTime are required' });
        }

        if (!duration || duration < 15) {
            return res.status(400).json({ error: 'duration must be at least 15 minutes' });
        }

        // Get access token for Microsoft Graph
        const tokenResponse = await axios.post(`http://localhost:${port}/api/auth/token`, 
            { scopes: ['https://graph.microsoft.com/Calendars.ReadWrite', 'https://graph.microsoft.com/Calendars.Read.Shared'] },
            { 
                headers: { 
                    'Authorization': `Bearer ${req.bootstrapToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const accessToken = tokenResponse.data.accessToken;

        // Get current user's domain to determine internal attendees
        const userProfileResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const currentUserDomain = userProfileResponse.data.mail ? userProfileResponse.data.mail.split('@')[1] : null;
        console.log('Current user domain:', currentUserDomain);

        // Separate internal and external attendees based on domain
        const internalAttendees = [];
        const externalAttendees = [];

        for (const email of attendees) {
            const attendeeDomain = email.split('@')[1];
            
            // Internal if same domain as current user, external otherwise
            if (currentUserDomain && attendeeDomain === currentUserDomain) {
                internalAttendees.push(email);
            } else {
                externalAttendees.push(email);
            }
        }

        console.log('Internal attendees:', internalAttendees);
        console.log('External attendees:', externalAttendees);
        const attendeesAvailability = [];

        // Get availability for internal attendees using Microsoft Graph
        if (internalAttendees.length > 0) {
            try {
                console.log('Requesting schedule for internal attendees:', internalAttendees);
                
                const scheduleRequest = {
                    schedules: internalAttendees.slice(0, 20), // Limit to 20 users
                    startTime: {
                        dateTime: startTime,
                        timeZone: timeZone
                    },
                    endTime: {
                        dateTime: endTime,
                        timeZone: timeZone
                    },
                    availabilityViewInterval: 15 // 15 minutes for better granularity
                };

                console.log('Schedule request:', JSON.stringify(scheduleRequest, null, 2));

                const graphResponse = await axios.post('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', scheduleRequest, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log('Graph response received:', graphResponse.data);

                // Process internal attendees' availability
                graphResponse.data.value.forEach((schedule, index) => {
                    const email = internalAttendees[index];
                    const freeBusyTimes = [];
                    
                    console.log(`Processing schedule for ${email}:`, schedule);
                    
                    // Convert availability view to free/busy times
                    // availabilityView is a string where each character represents a 15-minute interval
                    if (schedule.availabilityView && typeof schedule.availabilityView === 'string' && schedule.availabilityView.length > 0) {
                        const startDateTime = new Date(startTime);
                        let hasAnyBusyTime = false;
                        
                        // Convert string to array of characters and process each interval
                        for (let intervalIndex = 0; intervalIndex < schedule.availabilityView.length; intervalIndex++) {
                            const status = schedule.availabilityView[intervalIndex];
                            
                            if (status !== '0') { // 0 = free, 1 = tentative, 2 = busy, 3 = oof, 4 = working elsewhere
                                hasAnyBusyTime = true;
                                const intervalStart = new Date(startDateTime.getTime() + intervalIndex * 15 * 60 * 1000);
                                const intervalEnd = new Date(intervalStart.getTime() + 15 * 60 * 1000);
                                
                                freeBusyTimes.push({
                                    start: intervalStart.toISOString(),
                                    end: intervalEnd.toISOString()
                                });
                                
                            const londonStart = new Date(intervalStart.toLocaleString("en-US", {timeZone: "Europe/London"}));
                            const londonEnd = new Date(intervalEnd.toLocaleString("en-US", {timeZone: "Europe/London"}));
                            console.log(`${email} - Busy interval ${intervalIndex}: 
                            UTC: ${intervalStart.toISOString()} - ${intervalEnd.toISOString()}
                            London: ${intervalStart.toLocaleString("en-GB", {timeZone: "Europe/London"})} - ${intervalEnd.toLocaleString("en-GB", {timeZone: "Europe/London"})}
                            (status: ${status})`);
                            }
                        }
                        
                        console.log(`${email} - Found ${freeBusyTimes.length} busy periods out of ${schedule.availabilityView.length} intervals, hasAnyBusyTime: ${hasAnyBusyTime}`);
                        console.log(`${email} - Sample availability string: "${schedule.availabilityView.substring(0, 50)}..."`);
                    } else {
                        console.log(`${email} - No availability view data received or invalid format`);
                    }

                    // Map status codes to readable format
                    const getFreeBusyViewType = (availabilityView) => {
                        if (!availabilityView || typeof availabilityView !== 'string' || availabilityView.length === 0) {
                            console.log(`${email} - No availability view, marking as unknown`);
                            return 'unknown';
                        }
                        
                        // Count occurrences of each status (string characters)
                        const statusCounts = {};
                        for (let i = 0; i < availabilityView.length; i++) {
                            const status = availabilityView[i];
                            statusCounts[status] = (statusCounts[status] || 0) + 1;
                        }

                        console.log(`${email} - Status counts:`, statusCounts);

                        // Return most common status
                        const dominantStatus = Object.keys(statusCounts).reduce((a, b) => 
                            statusCounts[a] > statusCounts[b] ? a : b
                        );

                        const statusMap = {
                            '0': 'free',
                            '1': 'tentative', 
                            '2': 'busy',
                            '3': 'oof',
                            '4': 'workingElsewhere'
                        };

                        const result = statusMap[dominantStatus] || 'unknown';
                        console.log(`${email} - Dominant status: ${dominantStatus} -> ${result}`);
                        return result;
                    };

                    attendeesAvailability.push({
                        email,
                        displayName: email.split('@')[0], // Fallback display name
                        isExternal: false,
                        freeBusyViewType: getFreeBusyViewType(schedule.availabilityView),
                        freeBusyTimes
                    });
                });

            } catch (graphError) {
                console.error('Graph API error for internal attendees:', graphError.response?.data || graphError.message);
                
                // Add internal attendees with error status - DON'T default to available
                internalAttendees.forEach(email => {
                    attendeesAvailability.push({
                        email,
                        displayName: email.split('@')[0],
                        isExternal: false,
                        freeBusyViewType: 'unknown',
                        freeBusyTimes: [],
                        error: `Calendar access denied: ${graphError.response?.data?.error?.message || graphError.message}`
                    });
                });
            }
        }

        // Handle external attendees (limited availability data)
        externalAttendees.forEach(email => {
            attendeesAvailability.push({
                email,
                displayName: email.split('@')[0],
                isExternal: true,
                freeBusyViewType: 'unknown',
                freeBusyTimes: [],
                error: 'External attendee - limited calendar access'
            });
        });

        // Generate suggested time slots
        const suggestedSlots = generateTimeSlots(startTime, endTime, duration, attendeesAvailability, constraints);

        const response = {
            attendeesAvailability,
            suggestedSlots,
            timeRange: {
                start: startTime,
                end: endTime,
                timeZone
            }
        };

        console.log('Final availability response:', JSON.stringify(response, null, 2));
        res.json(response);

    } catch (error) {
        console.error('Availability analysis error:', error);
        res.status(500).json({ 
            error: 'Failed to analyze availability', 
            details: error.response?.data?.error || error.message 
        });
    }
});

// Helper function to generate time slots with availability analysis
function generateTimeSlots(startTime, endTime, duration, attendeesAvailability, constraints) {
    const slots = [];
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = duration * 60 * 1000;
    
    // First, check specific time options if provided
    if (constraints?.specificTimeOptions && constraints.specificTimeOptions.length > 0) {
        console.log('Checking specific time options:', constraints.specificTimeOptions);
        
        for (const timeOption of constraints.specificTimeOptions) {
            // Parse the specific time option
            const optionDate = new Date(timeOption.date);
            const [startHour, startMinute] = timeOption.startTime.split(':').map(Number);
            const [endHour, endMinute] = timeOption.endTime.split(':').map(Number);
            
            const slotStart = new Date(optionDate);
            slotStart.setHours(startHour, startMinute, 0, 0);
            
            const slotEnd = new Date(optionDate);
            slotEnd.setHours(endHour, endMinute, 0, 0);
            
            // Analyze availability for this specific slot
            const analysis = analyzeSlotAvailability(slotStart, slotEnd, attendeesAvailability);
            
            slots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
                isAvailable: analysis.isAvailable,
                conflictCount: analysis.conflictCount,
                attendeesAvailable: analysis.attendeesAvailable,
                attendeesConflict: analysis.attendeesConflict,
                confidence: analysis.confidence + 20 // Boost confidence for specific suggestions
            });
        }
    }
    
    // Generate additional slots every 30 minutes during business hours (9 AM - 6 PM)
    const current = new Date(start);
    
    while (current.getTime() + durationMs <= end.getTime()) {
        // Skip non-business hours (before 9 AM or after 6 PM)
        const hour = current.getHours();
        if (hour < 9 || hour >= 18) {
            current.setTime(current.getTime() + 30 * 60 * 1000); // Move 30 minutes
            continue;
        }

        // Check if this time fits preferred time windows (if specified)
        if (constraints?.preferredTimes && constraints.preferredTimes.length > 0) {
            const enabledPreferences = constraints.preferredTimes.filter(p => p.enabled);
            if (enabledPreferences.length > 0) {
                const isInPreferredWindow = enabledPreferences.some(pref => 
                    hour >= pref.startHour && hour < pref.endHour
                );
                
                if (!isInPreferredWindow) {
                    current.setTime(current.getTime() + 30 * 60 * 1000); // Move 30 minutes
                    continue;
                }
            }
        }

        // Skip weekends
        const dayOfWeek = current.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            current.setDate(current.getDate() + 1);
            current.setHours(9, 0, 0, 0); // Reset to 9 AM of next day
            continue;
        }

        const slotStart = new Date(current);
        const slotEnd = new Date(current.getTime() + durationMs);
        
        // Analyze availability for this slot
        const analysis = analyzeSlotAvailability(slotStart, slotEnd, attendeesAvailability);
        
        if (analysis.isAvailable || analysis.conflictCount < attendeesAvailability.length) {
            let confidence = analysis.confidence;
            
            // Boost confidence if in preferred time window
            if (constraints?.preferredTimes && constraints.preferredTimes.length > 0) {
                const enabledPreferences = constraints.preferredTimes.filter(p => p.enabled);
                const isInPreferredWindow = enabledPreferences.some(pref => 
                    slotStart.getHours() >= pref.startHour && slotStart.getHours() < pref.endHour
                );
                if (isInPreferredWindow) {
                    confidence = Math.min(confidence + 15, 100); // Boost for preferred times
                }
            }
            
            slots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
                isAvailable: analysis.isAvailable,
                conflictCount: analysis.conflictCount,
                attendeesAvailable: analysis.attendeesAvailable,
                attendeesConflict: analysis.attendeesConflict,
                confidence: confidence
            });
        }

        current.setTime(current.getTime() + 30 * 60 * 1000); // Move 30 minutes
    }

    // Sort by confidence score (highest first) and return top 10
    return slots
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10);
}

// Helper function to analyze availability for a specific time slot
function analyzeSlotAvailability(slotStart, slotEnd, attendeesAvailability) {
    const attendeesAvailable = [];
    const attendeesConflict = [];
    let conflictCount = 0;

    attendeesAvailability.forEach(attendee => {
        let hasConflict = false;

        // Check if attendee has any conflicts during this slot
        if (attendee.freeBusyTimes && attendee.freeBusyTimes.length > 0) {
            hasConflict = attendee.freeBusyTimes.some(busyTime => {
                const busyStart = new Date(busyTime.start);
                const busyEnd = new Date(busyTime.end);
                
                // Check for overlap
                return (slotStart < busyEnd && slotEnd > busyStart);
            });
        }

        if (hasConflict) {
            attendeesConflict.push(attendee.email);
            conflictCount++;
        } else {
            attendeesAvailable.push(attendee.email);
        }
    });

    // Calculate confidence score
    const totalAttendees = attendeesAvailability.length;
    const availableCount = totalAttendees - conflictCount;
    let confidence = totalAttendees > 0 ? Math.round((availableCount / totalAttendees) * 100) : 0;

    // Boost confidence for external attendees (unknown availability)
    const externalCount = attendeesAvailability.filter(a => a.isExternal).length;
    if (externalCount > 0 && conflictCount === 0) {
        confidence = Math.min(confidence + 10, 100); // Small boost for external attendees
    }

    // Boost confidence for prime meeting times (10 AM - 4 PM)
    const hour = slotStart.getHours();
    if (hour >= 10 && hour <= 16) {
        confidence = Math.min(confidence + 5, 100);
    }

    return {
        isAvailable: conflictCount === 0,
        conflictCount,
        attendeesAvailable,
        attendeesConflict,
        confidence
    };
}


// Mount routes
app.use('/api/oam', oamRoutes);
app.use('/api/meetings', validateBootstrapToken, meetingsRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Meeting Optimizer API server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
});

module.exports = app; 