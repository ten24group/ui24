import { InternalAxiosRequestConfig } from 'axios';

export interface IAuthProvider {
    setToken(token: string | null): void;
    removeToken(): void;
    getToken(): string | null;
    processToken : (response: any) => boolean;
    requestHeaders(config: InternalAxiosRequestConfig<any>): void;
  }