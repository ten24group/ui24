import { IAuthProvider } from "./interface";
import { InternalAxiosRequestConfig } from "axios";

export class LocalStorageAuthProvider implements IAuthProvider {
  setToken(token: string) {
    localStorage.setItem('token', token);
  }

  removeToken() {
    localStorage.removeItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  processToken = (response: any): boolean => {
    if (response.data && response.data.token) {
      this.setToken(response.data.token);
      return true
    }
    return false
  }

  requestHeaders = (config: InternalAxiosRequestConfig<any>) => {
    const token = this.getToken();
    if (token) {
      config.headers[ 'Authorization' ] = `Bearer ${token}`;
    }
  }
}