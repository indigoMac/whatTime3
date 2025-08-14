/**
 * Outlook Actionable Messages Email Template
 * Generates emails with Adaptive Cards for interactive time selection
 */

const { buildAdaptiveCard } = require('./adaptiveCard');

/**
 * Generate email with Adaptive Card for time selection
 * @param {Object} meeting - Meeting proposal object
 * @param {string} recipientEmail - Email of the recipient
 * @param {string} baseUrl - Base URL (unused, kept for API compatibility)
 */
function generateTimeSelectionEmail(meeting, recipientEmail, baseUrl) {
    // Determine recipient info
    const participant = meeting.vitalParticipants.find(p => p.email === recipientEmail);
    const recipientName = participant?.name || recipientEmail.split('@')[0];
    const organizerName = meeting.organizerName || 'Meeting Organizer';

    // Build Adaptive Card
    let adaptiveCardScript = '';
    try {
        // Use PUBLIC_API_BASE for the API endpoint
        const apiBase = process.env.PUBLIC_API_BASE || baseUrl;
        
        const adaptiveCard = buildAdaptiveCard({
            pollId: meeting.id,
            recipientUpn: recipientEmail,
            apiBase: apiBase,
            slots: meeting.proposedTimeSlots,
            meetingTitle: meeting.title,
            organizerName: organizerName,
            duration: meeting.duration
        });
        
        // Embed Adaptive Card as JSON script
        adaptiveCardScript = `
    <script type="application/adaptivecard+json">
${JSON.stringify(adaptiveCard, null, 2)}
    </script>
        `;
    } catch (error) {
        console.error('Error building Adaptive Card:', error);
        // Continue without Adaptive Card if there's an error
        adaptiveCardScript = '';
    }

    // Clean, minimal HTML with just the Adaptive Card
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Time Selection - ${meeting.title}</title>
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background-color: #f8f9fa;
            color: #1f2937;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 24px;
        }
        .fallback-message {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            text-align: center;
        }
    </style>
</head>
<body>
    ${adaptiveCardScript}
    <div class="container">
        <h1 style="margin: 0 0 16px 0; color: #1f2937;">📅 Meeting Time Selection</h1>
        <p><strong>Meeting:</strong> ${meeting.title}</p>
        <p><strong>Organizer:</strong> ${organizerName}</p>
        <p><strong>Duration:</strong> ${meeting.duration} minutes</p>
        ${meeting.location ? `<p><strong>Location:</strong> ${meeting.location}</p>` : ''}
        
        <div class="fallback-message">
            <p><strong>Can't see the interactive time selection above?</strong></p>
            <p>Your email client doesn't support Actionable Messages. Please use a supported Outlook client for the best experience.</p>
        </div>
    </div>
</body>
</html>`;

    // Simplified plain text
    const plainText = `
Meeting Time Selection - ${meeting.title}

Meeting: ${meeting.title}
Organizer: ${organizerName}  
Duration: ${meeting.duration} minutes
${meeting.location ? `Location: ${meeting.location}\n` : ''}

Please use Outlook to interact with the time selection card in this email.

--
This email was sent by WhatTime Meeting Optimizer`;

    return {
        html,
        plainText
    };
}

module.exports = {
    generateTimeSelectionEmail
};