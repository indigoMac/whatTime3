// Office.js API integration for Meeting Optimizer Add-in

/* global Office */

// Declare the Office variable
declare const Office: any

// Initialize the Office.js API
export function initializeOfficeJs() {
  return new Promise<void>((resolve, reject) => {
    try {
      // Check if Office.js is already loaded
      if (window.Office) {
        Office.onReady((info) => {
          if (info.host === Office.HostType.Outlook) {
            console.log("Office.js initialized in Outlook")
            resolve()
          } else {
            reject(new Error("This add-in is designed to run in Outlook only"))
          }
        })
      } else {
        reject(new Error("Office.js is not loaded"))
      }
    } catch (error) {
      reject(error)
    }
  })
}

// Get the current user's email address
export async function getCurrentUserEmail(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      Office.context.mailbox.getUserIdentityTokenAsync((result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          // In a real implementation, you would decode the token
          // For now, we'll use the user's email directly
          resolve(Office.context.mailbox.userProfile.emailAddress)
        } else {
          reject(new Error("Failed to get user identity token"))
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}

// Get the current item (email or appointment)
export function getCurrentItem() {
  return Office.context.mailbox.item
}

// Get recipients from the current item
export function getRecipients(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      const item = Office.context.mailbox.item
      if (item) {
        if (item.itemType === Office.MailboxEnums.ItemType.Appointment) {
          const recipients = item.requiredAttendees.map((attendee) => attendee.emailAddress)
          resolve(recipients)
        } else if (item.itemType === Office.MailboxEnums.ItemType.Message) {
          const recipients = item.to.map((recipient) => recipient.emailAddress)
          resolve(recipients)
        } else {
          resolve([])
        }
      } else {
        resolve([])
      }
    } catch (error) {
      reject(error)
    }
  })
}

// Set the subject of the current item
export function setSubject(subject: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const item = Office.context.mailbox.item
      if (item) {
        item.subject.setAsync(subject, (result) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            resolve()
          } else {
            reject(new Error("Failed to set subject"))
          }
        })
      } else {
        reject(new Error("No item available"))
      }
    } catch (error) {
      reject(error)
    }
  })
}

// Create a new meeting invitation
export function createMeetingInvite(details: {
  subject: string
  startTime: Date
  endTime: Date
  attendees: string[]
  location?: string
  body?: string
}): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Use Office.js to create a new appointment
      Office.context.mailbox.displayNewAppointmentForm({
        requiredAttendees: details.attendees,
        subject: details.subject,
        start: details.startTime,
        end: details.endTime,
        location: details.location || "",
        body: details.body || ""
      })
      resolve()
    } catch (error) {
      reject(error)
    }
  })
}

// Open Outlook compose dialog with pre-filled meeting data
export function openOutlookComposeDialog(meetingData: {
  title: string
  startTime: string
  endTime: string
  attendees: Array<{ email: string; name: string; type: string }>
  location?: string
  description?: string
}): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log('🗓️ Opening Outlook compose dialog with meeting data:', meetingData.title);
      
      // Convert attendees to email addresses array
      const attendeeEmails = meetingData.attendees.map(attendee => attendee.email);
      
      // Convert ISO strings to Date objects
      const startDate = new Date(meetingData.startTime);
      const endDate = new Date(meetingData.endTime);
      
      console.log('📧 Attendees:', attendeeEmails.join(', '));
      console.log('⏰ Time:', startDate.toLocaleString(), '-', endDate.toLocaleString());
      
      // Use Office.js to display the new appointment form
      Office.context.mailbox.displayNewAppointmentForm({
        requiredAttendees: attendeeEmails,
        subject: meetingData.title,
        start: startDate,
        end: endDate,
        location: meetingData.location || '',
        body: meetingData.description || ''
      });
      
      console.log('✅ Outlook compose dialog opened successfully');
      resolve();
    } catch (error) {
      console.error('❌ Error opening Outlook compose dialog:', error);
      reject(error);
    }
  });
}

// Close the task pane
export function closeTaskPane(): void {
  try {
    Office.context.ui.closeContainer()
  } catch (error) {
    console.error("Error closing task pane:", error)
  }
} 