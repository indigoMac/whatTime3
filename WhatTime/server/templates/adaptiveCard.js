/**
 * Adaptive Card Builder for Outlook Actionable Messages
 * Creates multi-select time slot cards for meeting coordination
 */

/**
 * Format a date/time for display in the card
 */
function formatDateTime(dateString) {
    const date = new Date(dateString);
    const options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleString('en-US', options);
}

/**
 * Build time choice options for the Input.ChoiceSet
 * @param {Array} slots - Array of time slot objects
 * @returns {Array} Array of choice objects for Adaptive Card
 */
function buildTimeChoices(slots) {
    if (!slots || !Array.isArray(slots)) {
        return [];
    }

    return slots.map(slot => {
        const startTime = formatDateTime(slot.startTime);
        const endTime = new Date(slot.endTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        return {
            title: `${startTime} - ${endTime}`,
            value: slot.id
        };
    });
}

/**
 * Build the main Adaptive Card for time selection
 * @param {Object} options - Card configuration
 * @param {string} options.pollId - Meeting/poll ID
 * @param {string} options.recipientUpn - Recipient email/UPN
 * @param {string} options.apiBase - Base URL for API endpoints
 * @param {Array} options.slots - Array of proposed time slots
 * @param {string} options.meetingTitle - Title of the meeting
 * @param {string} options.organizerName - Name of the meeting organizer
 * @param {number} options.duration - Meeting duration in minutes
 * @returns {Object} Adaptive Card JSON
 */
function buildAdaptiveCard({ 
    pollId, 
    recipientUpn, 
    apiBase, 
    slots, 
    meetingTitle = 'Meeting',
    organizerName = 'Organizer',
    duration = 60
}) {
    const choices = buildTimeChoices(slots);
    
    if (choices.length === 0) {
        throw new Error('No time slots provided for Adaptive Card');
    }



    const card = {
        type: "AdaptiveCard",
        version: "1.0",
        body: [
            {
                type: "Container",
                items: [
                    {
                        type: "TextBlock",
                        text: "Meeting Time Selection",
                        size: "Large",
                        weight: "Bolder",
                        color: "Accent"
                    },
                    {
                        type: "TextBlock",
                        text: meetingTitle,
                        size: "Medium",
                        weight: "Bolder",
                        wrap: true,
                        spacing: "Small"
                    }
                ]
            },
            {
                type: "Container",
                separator: true,
                items: [
                    {
                        type: "FactSet",
                        facts: [
                            {
                                title: "Organizer:",
                                value: organizerName
                            },
                            {
                                title: "Duration:",
                                value: `${duration} minutes`
                            },
                            {
                                title: "Options:",
                                value: `${choices.length} time slots`
                            }
                        ]
                    }
                ]
            },
            {
                type: "Container",
                separator: true,
                spacing: "Medium",
                items: [
                    {
                        type: "TextBlock",
                        text: "Select all times that work for you:",
                        weight: "Bolder",
                        spacing: "Small"
                    },
                    {
                        type: "Input.ChoiceSet",
                        id: "times",
                        isMultiSelect: true,
                        style: "expanded",
                        choices: choices,
                        spacing: "Small"
                    }
                ]
            },
            {
                type: "Container",
                items: [
                    {
                        type: "TextBlock",
                        text: "💡 Tip: Select multiple times to help find the best slot for everyone",
                        size: "Small",
                        color: "Accent",
                        wrap: true,
                        spacing: "Small"
                    }
                ]
            }
        ],
        actions: [
            {
                type: "Action.Http",
                title: "Submit Available Times",
                method: "POST",
                url: `${apiBase}/api/oam/submit`,
                headers: [
                    {
                        name: "Content-Type",
                        value: "application/json"
                    }
                ],
                body: `{
                    "pollId": "${pollId.replace(/"/g, '\\"')}",
                    "user": "${recipientUpn.replace(/"/g, '\\"')}",
                    "slots": "{{times.value}}"
                }`,
                isPrimary: true,
                style: "positive"
            }
        ],
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json"
    };

    return card;
}

/**
 * Build a fallback card for clients that don't support certain features
 */
function buildFallbackCard({ meetingTitle, organizerName }) {
    return {
        type: "AdaptiveCard",
        version: "1.0",
        body: [
            {
                type: "Container",
                items: [
                    {
                        type: "TextBlock",
                        text: "Meeting Time Selection",
                        size: "Large",
                        weight: "Bolder",
                        color: "Accent"
                    },
                    {
                        type: "TextBlock",
                        text: meetingTitle,
                        size: "Medium",
                        wrap: true
                    },
                    {
                        type: "TextBlock",
                        text: `${organizerName} has requested your availability for a meeting.`,
                        wrap: true,
                        spacing: "Medium"
                    },
                    {
                        type: "TextBlock",
                        text: "⚠️ Your email client doesn't support interactive time selection.",
                        color: "Warning",
                        wrap: true,
                        spacing: "Medium"
                    },
                    {
                        type: "TextBlock",
                        text: "Please use the buttons in the email below to select your available times.",
                        wrap: true,
                        spacing: "Small"
                    }
                ]
            }
        ],
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json"
    };
}

module.exports = {
    buildTimeChoices,
    buildAdaptiveCard,
    buildFallbackCard,
    formatDateTime
};