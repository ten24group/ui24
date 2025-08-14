import { LocalStorageAuthProvider } from './localStorage';
import { InternalAxiosRequestConfig } from 'axios';

describe('LocalStorageAuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return null for getToken/getRefreshToken when empty', () => {
    const provider = new LocalStorageAuthProvider();
    expect(provider.getToken()).toBeNull();
    expect(provider.getRefreshToken()).toBeNull();
  });

  it('should set and get token string', () => {
    const provider = new LocalStorageAuthProvider();
    provider.setToken('abc');
    expect(localStorage.getItem('token')).toBe('abc');
    expect(provider.getToken()).toBe('abc');
    expect(provider.getRefreshToken()).toBeNull();
  });

  it('should set and get token object', () => {
    const data = { token: 'abc', refreshToken: 'def' };
    const provider = new LocalStorageAuthProvider();
    provider.setToken(data);
    expect(provider.getToken()).toBe('abc');
    expect(provider.getRefreshToken()).toBe('def');
    expect(localStorage.getItem('token')).toBe('abc');
    expect(localStorage.getItem('refreshToken')).toBe('def');
  });

  it('processToken should save new tokens', () => {
    const provider = new LocalStorageAuthProvider();
    const fakeResponse: any = { data: { token: 'x', refreshToken: 'y' } };
    provider.processToken(fakeResponse);
    expect(provider.getToken()).toBe('x');
    expect(provider.getRefreshToken()).toBe('y');
  });

  it('removeToken should clear storage', () => {
    const provider = new LocalStorageAuthProvider();
    provider.setToken({ token: 'a', refreshToken: 'b' });
    provider.removeToken();
    expect(provider.getToken()).toBeNull();
    expect(provider.getRefreshToken()).toBeNull();
  });

  it('requestHeaders should set Authorization if token exists', () => {
    const provider = new LocalStorageAuthProvider();
    provider.setToken('mytoken');
    const config: any = { headers: {} } as InternalAxiosRequestConfig;
    provider.requestHeaders(config);
    expect(config.headers[ 'Authorization' ]).toBe('Bearer mytoken');
  });
}); 