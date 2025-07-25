// Authentication service for Meeting Optimizer
// Handles SSO token exchange with existing backend API

/* global Office */

interface TokenResponse {
  accessToken: string;
  expiresOn?: Date;
  scopes?: string[];
  cached?: boolean;
}

interface UserProfile {
  displayName: string;
  mail: string;
  id: string;
  userPrincipalName: string;
}

class AuthService {
  private bootstrapToken: string | null = null;
  private graphToken: string | null = null;
  private userProfile: UserProfile | null = null;
  private readonly baseUrl = 'http://localhost:3001'; // Backend API URL

  async initialize(): Promise<boolean> {
    try {
      // Get bootstrap token from Office
      this.bootstrapToken = await this.getBootstrapToken();
      
      if (this.bootstrapToken) {
        // Exchange for Graph token
        await this.exchangeForGraphToken();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Authentication initialization failed:', error);
      return false;
    }
  }

  private async getBootstrapToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      Office.auth.getAccessToken({
        allowSignInPrompt: true,
        allowConsentPrompt: true,
        forMSGraphAccess: true
      })
      .then((bootstrapToken) => {
        resolve(bootstrapToken);
      })
      .catch((error) => {
        console.error('Failed to get bootstrap token:', error);
        reject(error);
      });
    });
  }

  private async exchangeForGraphToken(): Promise<void> {
    if (!this.bootstrapToken) {
      throw new Error('No bootstrap token available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bootstrapToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scopes: [
            'https://graph.microsoft.com/Calendars.Read',
            'https://graph.microsoft.com/User.Read',
            'https://graph.microsoft.com/email',
            'https://graph.microsoft.com/openid',
            'https://graph.microsoft.com/profile'
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token exchange failed: ${errorData.error}`);
      }

      const tokenData: TokenResponse = await response.json();
      this.graphToken = tokenData.accessToken;
    } catch (error) {
      console.error('Token exchange failed:', error);
      throw error;
    }
  }

  async getUserProfile(): Promise<UserProfile> {
    if (this.userProfile) {
      return this.userProfile;
    }

    if (!this.bootstrapToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${this.bootstrapToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to get user profile: ${errorData.error}`);
      }

      this.userProfile = await response.json();
      return this.userProfile;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw error;
    }
  }

  async getCalendarEvents(startTime?: string, endTime?: string): Promise<any[]> {
    if (!this.bootstrapToken) {
      throw new Error('Not authenticated');
    }

    try {
      let url = `${this.baseUrl}/api/calendar/events`;
      if (startTime && endTime) {
        url += `?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.bootstrapToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to get calendar events: ${errorData.error}`);
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      console.error('Failed to get calendar events:', error);
      throw error;
    }
  }

  async optimizeMeeting(attendees: string[], duration: number, preferredTimes?: string[]): Promise<any> {
    if (!this.bootstrapToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/meetings/optimize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bootstrapToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attendees,
          duration,
          preferredTimes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Meeting optimization failed: ${errorData.error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Meeting optimization failed:', error);
      throw error;
    }
  }

  isAuthenticated(): boolean {
    return !!this.bootstrapToken;
  }

  getToken(): string | null {
    return this.bootstrapToken;
  }

  async signOut(): Promise<void> {
    this.bootstrapToken = null;
    this.graphToken = null;
    this.userProfile = null;
    // Office.auth doesn't have a sign out method, but we clear our local state
  }
}

export const authService = new AuthService(); 