require('dotenv').config();
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No valid authorization header found' });
    }

    const token = authHeader.substring(7);
    
    jwt.verify(token, getKey, {
        audience: clientConfig.auth.clientId,
        issuer: /^https:\/\/login\.microsoftonline\.com\/.*\/v2\.0$/
    }, (err, decoded) => {
        if (err) {
            console.error('Token validation error:', err);
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        req.user = decoded;
        req.bootstrapToken = token;
        next();
    });
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Meeting Optimizer API is running' });
});

// Exchange bootstrap token for Microsoft Graph access token
app.post('/api/auth/token', validateBootstrapToken, async (req, res) => {
    try {
        const { scopes } = req.body;
        const defaultScopes = [
            'https://graph.microsoft.com/Calendars.Read',
            'https://graph.microsoft.com/User.Read',
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
            { scopes: ['https://graph.microsoft.com/Calendars.Read'] },
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