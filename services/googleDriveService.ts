
/**
 * Service to handle Google Drive exports.
 * Note: Requires a valid CLIENT_ID from Google Cloud Console.
 */

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Placeholder: User would need to provide this in a real app.
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export interface DriveUploadTarget {
  name: string;
  base64: string;
  mimeType: string;
}

export class GoogleDriveService {
  private tokenClient: any;
  private accessToken: string | null = null;

  constructor() {
    this.initTokenClient();
  }

  private initTokenClient() {
    if (typeof window !== 'undefined' && (window as any).google) {
      this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error !== undefined) {
            throw response;
          }
          this.accessToken = response.access_token;
        },
      });
    }
  }

  async authorize(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response: any) => {
            if (response.error) reject(response);
            this.accessToken = response.access_token;
            resolve(response.access_token);
          },
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (e) {
        reject(e);
      }
    });
  }

  async createFolder(name: string): Promise<string> {
    const metadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    const data = await response.json();
    return data.id;
  }

  async uploadFile(target: DriveUploadTarget, folderId?: string): Promise<void> {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = {
      name: target.name,
      mimeType: target.mimeType,
      parents: folderId ? [folderId] : [],
    };

    const base64Data = target.base64.split(',')[1];
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + target.mimeType + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n' +
      '\r\n' +
      base64Data +
      close_delim;

    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'multipart/related; boundary=' + boundary,
      },
      body: multipartRequestBody,
    });
  }
}

export const driveService = new GoogleDriveService();
