import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { AuthCredentials, SessionData } from './types';

export class AuthManager {
  private baseURL = 'https://challenge.sunvoy.com';
  private sessionFile = path.join(process.cwd(), 'session.json');
  private axiosInstance: AxiosInstance;
  private sessionData: SessionData | null = null;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
  }

  private loadSessionFromFile(): SessionData | null {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const data = fs.readFileSync(this.sessionFile, 'utf8');
        const session: SessionData = JSON.parse(data);
        
        if (session.expiryTime > Date.now()) {
          return session;
        } else {
          console.log('Stored session has expired, will authenticate again');
          fs.unlinkSync(this.sessionFile);
        }
      }
    } catch (error) {
      console.log('Could not load session from file:', error);
    }
    return null;
  }

  private saveSessionToFile(session: SessionData): void {
    try {
      fs.writeFileSync(this.sessionFile, JSON.stringify(session, null, 2));
      console.log('Session saved for future use');
    } catch (error) {
      console.error('Could not save session to file:', error);
    }
  }

  private setCookiesInAxios(cookies: string[]): void {
    if (cookies.length > 0) {
      this.axiosInstance.defaults.headers.common['Cookie'] = cookies.join('; ');
    }
  }

  async authenticate(credentials: AuthCredentials): Promise<boolean> {
    try {
      this.sessionData = this.loadSessionFromFile();
      if (this.sessionData) {
        console.log('Using existing valid session');
        this.setCookiesInAxios(this.sessionData.cookies);
        return true;
      }

      console.log('Authenticating with fresh credentials...');

      console.log('Getting login page...');
      const loginPageResponse = await this.axiosInstance.get('/login', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      
      const setCookieHeaders = loginPageResponse.headers['set-cookie'] || [];
      const cookies = setCookieHeaders.map((cookie: string) => cookie.split(';')[0]);
      console.log('Received cookies:', cookies.length);

      let nonce = '';
      const htmlContent = loginPageResponse.data;
      const nonceMatch = htmlContent.match(/name="nonce"[^>]*value="([^"]+)"/);
      if (nonceMatch) {
        nonce = nonceMatch[1];
        console.log('Found nonce token');
      }

      this.setCookiesInAxios(cookies);

      const loginData = `username=${encodeURIComponent(credentials.email)}&password=${encodeURIComponent(credentials.password)}&nonce=${encodeURIComponent(nonce)}`;

      console.log('Attempting login...');
      const loginResponse = await this.axiosInstance.post('/login', loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': this.baseURL + '/login'
        },
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });

      const newSetCookieHeaders = loginResponse.headers['set-cookie'] || [];
      if (newSetCookieHeaders.length > 0) {
        const newCookies = newSetCookieHeaders.map((cookie: string) => cookie.split(';')[0]);
        cookies.push(...newCookies);
        this.setCookiesInAxios(cookies);
      }

      if (loginResponse.status === 200 || loginResponse.status === 302) {
        console.log('Login successful');
        this.sessionData = {
          cookies: cookies,
          csrfToken: nonce,
          expiryTime: Date.now() + (24 * 60 * 60 * 1000)
        };
        
        this.saveSessionToFile(this.sessionData);
        console.log('Authentication successful');
        return true;
      }

      console.error('Authentication failed - unexpected status:', loginResponse.status);
      return false;

    } catch (error: any) {
      console.error('Authentication error:', error.message || error);
      return false;
    }
  }

  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  isAuthenticated(): boolean {
    return this.sessionData !== null;
  }
} 