export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  accessToken?: string;
  openId?: string;
  operateId?: string;
  language?: string;
  [key: string]: any;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SessionData {
  cookies: string[];
  csrfToken?: string;
  expiryTime: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
} 