/**
 * Interactive HTML Email Template for Time Selection
 * Handles fallback for email clients that block interactive content
 */

/**
 * Generate interactive email HTML with clickable time slots
 * @param {Object} meeting - Meeting proposal object
 * @param {string} recipientEmail - Email of the recipient
 * @param {string} baseUrl - Base URL for tracking links
 */
function generateTimeSelectionEmail(meeting, recipientEmail, baseUrl) {
    const trackingUrls = {};
    
    // Generate tracking URLs for each time slot
    meeting.proposedTimeSlots.forEach(slot => {
        trackingUrls[slot.id] = meeting.getTrackingUrl(baseUrl, recipientEmail, slot.id);
    });

    // Determine recipient info
    const participant = meeting.vitalParticipants.find(p => p.email === recipientEmail);
    const recipientName = participant?.name || recipientEmail.split('@')[0];

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Time Selection - ${meeting.title}</title>
    <style>
        /* Email-safe CSS */
        body { 
            margin: 0; 
            padding: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background-color: #f8f9fa;
            color: #1f2937;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
        }
        .header {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            padding: 24px;
            text-align: center;
        }
        .content { 
            padding: 32px 24px; 
        }
        .time-slot {
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            margin: 12px 0;
            transition: all 0.2s ease;
            overflow: hidden;
            background: white;
        }
        .time-slot:hover {
            border-color: #3b82f6;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        }
        .time-slot-link {
            display: block;
            padding: 20px 24px;
            text-decoration: none;
            color: inherit;
        }
        .time-slot-link:hover {
            text-decoration: none;
            color: inherit;
        }
        .time-day {
            font-weight: 600;
            font-size: 16px;
            color: #1f2937;
            margin-bottom: 4px;
        }
        .time-details {
            color: #6b7280;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
        }
        .time-icon {
            width: 16px;
            height: 16px;
            display: inline-block;
            vertical-align: middle;
        }
        .meeting-info {
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
            border-left: 4px solid #3b82f6;
        }
        .fallback-section {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
        }
        .footer {
            background: #f8f9fa;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #3b82f6;
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            margin: 8px 8px 8px 0;
        }
        .btn:hover {
            background: #2563eb;
        }
        .urgent-badge {
            display: inline-block;
            background: #ef4444;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        @media (max-width: 600px) {
            .container { margin: 0; }
            .content { padding: 24px 16px; }
            .time-details { flex-direction: column; align-items: flex-start; gap: 8px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">
                📅 Meeting Time Selection
            </h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">
                Help us find the perfect time for everyone
            </p>
        </div>

        <!-- Content -->
        <div class="content">
            <p>Hi ${recipientName},</p>
            
            <p>You've been invited to participate in <strong>"${meeting.title}"</strong>. 
               Please select your preferred time by clicking on one of the options below:</p>

            <!-- Meeting Info -->
            <div class="meeting-info">
                <h3 style="margin: 0 0 12px 0; color: #1f2937;">Meeting Details</h3>
                <div style="margin-bottom: 8px;">
                    <strong>Title:</strong> ${meeting.title}
                </div>
                ${meeting.location ? `
                <div style="margin-bottom: 8px;">
                    <strong>Location:</strong> ${meeting.location}
                </div>
                ` : ''}
                <div style="margin-bottom: 8px;">
                    <strong>Duration:</strong> ${meeting.duration} minutes
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Organizer:</strong> ${meeting.organizerId}
                </div>
                ${meeting.description ? `
                <div style="margin-top: 12px;">
                    <strong>Description:</strong><br>
                    ${meeting.description}
                </div>
                ` : ''}
            </div>

            <!-- Time Selection -->
            <h3 style="color: #1f2937; margin: 24px 0 16px 0;">
                Select Your Preferred Time:
                <span class="urgent-badge">Response Required</span>
            </h3>

            ${meeting.proposedTimeSlots.map(slot => {
                const startDate = new Date(slot.startTime);
                const endDate = new Date(slot.endTime);
                const dayName = startDate.toLocaleDateString('en-US', { weekday: 'long' });
                const dateStr = startDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
                const timeStr = `${startDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    hour12: true 
                })} - ${endDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    hour12: true 
                })}`;
                const timezone = meeting.timeZone === 'UTC' ? 'UTC' : meeting.timeZone;

                return `
                <div class="time-slot">
                    <a href="${trackingUrls[slot.id]}" class="time-slot-link">
                        <div class="time-day">${dayName}, ${dateStr}</div>
                        <div class="time-details">
                            <span>🕒 ${timeStr}</span>
                            <span>🌍 ${timezone}</span>
                        </div>
                    </a>
                </div>
                `;
            }).join('')}

            <!-- Fallback Section -->
            <div class="fallback-section">
                <h4 style="margin: 0 0 8px 0; color: #92400e;">Having trouble with the buttons above?</h4>
                <p style="margin: 0 0 12px 0; font-size: 14px;">
                    If clicking doesn't work, copy and paste one of these links into your browser:
                </p>
                ${meeting.proposedTimeSlots.map((slot, index) => {
                    const startDate = new Date(slot.startTime);
                    const dateStr = startDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    const timeStr = startDate.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit', 
                        hour12: true 
                    });
                    
                    return `
                    <div style="margin: 8px 0; font-size: 13px;">
                        <strong>Option ${index + 1} (${dateStr} at ${timeStr}):</strong><br>
                        <a href="${trackingUrls[slot.id]}" style="word-break: break-all; color: #3b82f6;">
                            ${trackingUrls[slot.id]}
                        </a>
                    </div>
                    `;
                }).join('')}
            </div>

            <!-- Additional Info -->
            <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 14px; color: #6b7280; margin: 0;">
                    <strong>Important:</strong> Please respond as soon as possible. 
                    Once all vital participants have responded, the organizer will send the final meeting invite.
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p style="margin: 0;">This email was sent by WhatTime Meeting Optimizer</p>
            <p style="margin: 8px 0 0 0;">
                If you have questions, please contact the meeting organizer directly.
            </p>
        </div>
    </div>

    <!-- Email tracking pixel -->
    <img src="${baseUrl}/api/meetings/${meeting.id}/track/open?email=${encodeURIComponent(recipientEmail)}&token=${meeting.emailTrackingTokens[recipientEmail]}" 
         width="1" height="1" style="display: none;" alt="">
</body>
</html>
    `;

    // Generate plain text version for fallback
    const plainText = `
Meeting Time Selection - ${meeting.title}

Hi ${recipientName},

You've been invited to participate in "${meeting.title}". Please select your preferred time by visiting one of the links below:

Meeting Details:
- Title: ${meeting.title}
${meeting.location ? `- Location: ${meeting.location}\n` : ''}- Duration: ${meeting.duration} minutes
- Organizer: ${meeting.organizerId}
${meeting.description ? `- Description: ${meeting.description}\n` : ''}

Time Options:

${meeting.proposedTimeSlots.map((slot, index) => {
    const startDate = new Date(slot.startTime);
    const endDate = new Date(slot.endTime);
    const dayName = startDate.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = startDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
    });
    const timeStr = `${startDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    })} - ${endDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    })}`;
    
    return `Option ${index + 1}: ${dayName}, ${dateStr} at ${timeStr}
Click here: ${trackingUrls[slot.id]}`;
}).join('\n\n')}

Important: Please respond as soon as possible. Once all vital participants have responded, the organizer will send the final meeting invite.

--
This email was sent by WhatTime Meeting Optimizer
    `;

    return {
        html,
        plainText,
        trackingUrls
    };
}

module.exports = {
    generateTimeSelectionEmail
};