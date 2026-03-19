import crypto from 'node:crypto';
import axios from 'axios';

const TOKEN_URL = 'https://uas-api.inrix.com/v1/appToken';

export function computeHashToken(appId: string, appKey: string): string {
  const combined = `${appId}|${appKey}`.toLowerCase();
  return crypto.createHash('sha1').update(combined, 'utf8').digest('hex');
}

export class InrixAuthService {
  private appId: string;
  private appKey: string;
  private cachedToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor({ appId, appKey }: { appId: string; appKey: string }) {
    this.appId = appId;
    this.appKey = appKey;
  }

  async getToken(): Promise<string> {
    // Return cached token if valid and more than 5 minutes from expiry
    if (
      this.cachedToken !== null &&
      this.tokenExpiry !== null &&
      this.tokenExpiry.getTime() - Date.now() > 5 * 60 * 1000
    ) {
      return this.cachedToken;
    }

    // Acquire new token
    const hashToken = computeHashToken(this.appId, this.appKey);
    const response = await axios.get(TOKEN_URL, {
      params: { appId: this.appId, hashToken },
    });

    const token: string = response.data.result.token;
    this.cachedToken = token;
    this.tokenExpiry = new Date(response.data.result.expiry);

    return token;
  }

  invalidate(): void {
    this.cachedToken = null;
    this.tokenExpiry = null;
  }
}
