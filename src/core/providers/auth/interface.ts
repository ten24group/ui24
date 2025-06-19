import { InternalAxiosRequestConfig } from 'axios';

export interface IAuthProvider {
  setToken(token: string | null | object): void;
  removeToken(): void;
  getToken(): string | null;
  getRefreshToken(): string | null;
  refreshToken(): Promise<string | null>;
  processToken: (response: any) => boolean;
  requestHeaders(config: InternalAxiosRequestConfig<any>): void;
}