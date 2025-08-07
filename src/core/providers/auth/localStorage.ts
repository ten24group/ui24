import { IAuthProvider } from "./interface";
import { InternalAxiosRequestConfig } from "axios";
import { AxiosResponse } from 'axios';

export class LocalStorageAuthProvider implements IAuthProvider {
  setToken(tokenData: string | object) {
    if (typeof tokenData === 'string') {
      localStorage.setItem('token', tokenData);
    } else if (tokenData && typeof tokenData === 'object') {
      const token = (tokenData as any).token || (tokenData as any).idToken || (tokenData as any).IdToken;
      const refreshToken = (tokenData as any).refreshToken || (tokenData as any).RefreshToken;
      if (token) {
        localStorage.setItem('token', token);
      }
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
    }
  }

  removeToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  processToken = (response: any): boolean => {
    if (response.data) {
      this.setToken(response.data);
      return true
    }
    return false
  }

  refreshToken = async (): Promise<string | null> => {
    // Note: This requires a specific refresh endpoint to be configured for the default provider.
    // This is a placeholder implementation.
    console.error("RefreshToken functionality is not implemented for the default LocalStorageAuthProvider.");
    return null;
  }

  requestHeaders = (config: InternalAxiosRequestConfig<any>) => {
    const token = this.getToken();
    if (token) {
      config.headers[ 'Authorization' ] = `Bearer ${token}`;
    }
  }

  // New hook: attach auth to outgoing requests
  public async authenticateRequest(config: InternalAxiosRequestConfig<any>): Promise<InternalAxiosRequestConfig<any>> {
    this.requestHeaders(config);
    return config;
  }

  // New hook: process tokens from incoming responses
  public processResponse(response: AxiosResponse<any>): void {
    this.processToken(response);
  }

  // New hook: should refresh auth on 401 or 403
  public shouldRefreshAuth(error: any, _config: InternalAxiosRequestConfig<any>): boolean {
    const status = error.response?.status;
    return status === 401 || status === 403;
  }

  // New hook: refresh auth by calling refreshToken(); throw if unsuccessful
  public async refreshAuth(): Promise<void> {
    const newToken = await this.refreshToken();
    if (!newToken) {
      this.removeToken();
      throw new Error('Unable to refresh auth');
    }
  }

  // New hook: logout cleans up storage
  public logout(): void {
    this.removeToken();
  }
}