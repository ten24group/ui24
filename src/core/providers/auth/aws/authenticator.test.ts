// Prevent unhandled promise rejections in tests
process.on('unhandledRejection', () => { });

// Mock core/utils so we don't import @blocknote/core
jest.mock('../../../utils', () => ({
  isValidURL: jest.fn(() => true),
  addPathToUrl: jest.fn((base, path) => base + path),
}));

// Mock jwt-decode to always return an empty payload via named export
jest.mock('jwt-decode', () => ({ __esModule: true, jwtDecode: jest.fn(() => ({})) }));
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { RequestSigner } from './signer';
import { useAWSAuthenticator, AUTH_TOKEN_CACHE_KEY } from './authenticator';

// Shared fake signer and axios instance for tests
const fakeSigner = { signedHeaders: jest.fn(), signRequest: jest.fn() } as unknown as RequestSigner;
const axiosInstance = axios.create();

describe('AwsAuthenticator', () => {
  let auth: ReturnType<typeof useAWSAuthenticator>;

  beforeEach(() => {
    sessionStorage.clear();
    auth = useAWSAuthenticator({ requestSigner: fakeSigner, axiosInstance, rememberMe: false });
  });

  it('should return null for getToken/getRefreshToken when none set', () => {
    expect(auth.getToken()).toBeUndefined();
    expect(auth.getRefreshToken()).toBeUndefined();
  });

  it('should set and get tokens via setToken', () => {
    const data = { IdToken: 'id123', RefreshToken: 'rf123' };
    auth.setToken(JSON.stringify(data));
    expect(auth.getToken()).toBe('id123');
    expect(auth.getRefreshToken()).toBe('rf123');
  });

  it('processToken should save new tokens', () => {
    const fakeResponse: any = { data: { IdToken: 'id2', RefreshToken: 'rf2' } };
    expect(auth.processToken(fakeResponse)).toBe(true);
    expect(auth.getToken()).toBe('id2');
    expect(auth.getRefreshToken()).toBe('rf2');
  });

  it('removeToken should clear token and credentials', () => {
    auth.setToken(JSON.stringify({ IdToken: 'A', RefreshToken: 'B' }));
    auth.removeToken();
    expect(auth.getToken()).toBeUndefined();
    expect(auth.getRefreshToken()).toBeUndefined();
  });

  it('setCredentials and getCachedCredentials & isValidCredentials', async () => {
    const creds = { AccessKeyId: 'k', SecretKey: 's', SessionToken: 't', Expiration: new Date(Date.now() + 1000) };
    // Note: getCachedCredentials returns raw parsed object with original keys
    auth.setCredentials(creds as any);
    const cached = await auth.getCachedCredentials();
    expect(cached).toEqual(expect.objectContaining({ AccessKeyId: 'k', SecretKey: 's', SessionToken: 't' }));
    expect(auth.isValidCredentials(cached)).toBe(true);
  });

  it('getCachedCredentials returns null on malformed JSON', async () => {
    sessionStorage.setItem('cache_tmpAwsCredentials', 'not-json');
    const val = await auth.getCachedCredentials();
    expect(val).toBeNull();
  });

  it('isValidCredentials returns false for expired credentials', () => {
    const expired = { expiration: new Date(Date.now() - 1000) };
    expect(auth.isValidCredentials(expired as any)).toBe(false);
  });

  it('getCachedTokenData returns null when empty and parsed when valid', () => {
    const anyAuth = auth as any;
    expect(anyAuth.getCachedTokenData()).toBeNull();
    const obj = { foo: 'bar' };
    sessionStorage.setItem(AUTH_TOKEN_CACHE_KEY, JSON.stringify(obj));
    expect(anyAuth.getCachedTokenData()).toEqual(obj);
  });

  it('isValidTokenData always returns true', () => {
    const anyAuth = auth as any;
    expect(anyAuth.isValidTokenData({ any: 'value' })).toBe(true);
  });
});

// Additional tests for AWS_IAM-specific flows
describe('AwsAuthenticator extended behavior', () => {
  let authIam: ReturnType<typeof useAWSAuthenticator>;
  beforeEach(() => {
    sessionStorage.clear();
    authIam = useAWSAuthenticator({
      requestSigner: fakeSigner,
      axiosInstance,
      apiAuthMode: 'AWS_IAM',
      awsTempCredentialsApiEndPoint: '/creds',
      refreshTokenApiEndPoint: '/refresh',
      rememberMe: false,
    });
  });

  it('getNewTempAwsCredentials posts to AWS endpoint with idToken', async () => {
    // stub POST
    axiosInstance.post = jest.fn().mockResolvedValue({
      data: { Credentials: { AccessKeyId: 'k', SecretKey: 's', SessionToken: 't', Expiration: new Date(Date.now() + 1000) } }
    }) as any;
    authIam.setToken(JSON.stringify({ IdToken: 'id123' }));
    const res = await authIam.getNewTempAwsCredentials();
    expect((axiosInstance.post as jest.Mock).mock.calls[ 0 ][ 0 ]).toBe('/creds/');
    expect((axiosInstance.post as jest.Mock).mock.calls[ 0 ][ 1 ]).toEqual({ idToken: 'id123' });
    expect(res.data.Credentials).toBeDefined();
  });

  it('refreshToken success path stores new IdToken and calls getCredentials', async () => {
    const newTokens = { IdToken: 'newid', RefreshToken: 'newref' };
    // stub refreshIdToken
    authIam.refreshIdToken = jest.fn().mockResolvedValue({ data: newTokens });
    // stub getCredentials
    const creds = { accessKeyId: 'a', secretAccessKey: 'b', sessionToken: 'c', expiration: new Date() };
    jest.spyOn(authIam, 'getCredentials').mockResolvedValue(creds);

    const id = await authIam.refreshToken();
    expect(id).toBe('newid');
    // token should be stored in sessionStorage
    const stored = sessionStorage.getItem(AUTH_TOKEN_CACHE_KEY);
    expect(stored).toContain('newid');
    expect(authIam.getCredentials).toHaveBeenCalled();
  });

  it('refreshToken failure clears storage and returns null', async () => {
    authIam.refreshIdToken = jest.fn().mockRejectedValue(new Error('fail'));
    const removeSpy = jest.spyOn(authIam, 'removeToken');
    const id = await authIam.refreshToken();
    expect(removeSpy).toHaveBeenCalled();
    expect(id).toBeNull();
  });

  it('requestHeaders attaches Authorization on JWT mode', async () => {
    const authJwt = useAWSAuthenticator({ requestSigner: fakeSigner, axiosInstance, apiAuthMode: 'JWT', rememberMe: false });
    // set an IdToken in storage
    authJwt.setToken(JSON.stringify({ IdToken: 'myjwt' }));
    const config: any = { headers: {} };
    await authJwt.requestHeaders(config);
    expect(config.headers.Authorization).toBe('Bearer myjwt');
  });

  it('requestHeaders signs with AWS_IAM mode', async () => {
    const authIam2 = useAWSAuthenticator({ requestSigner: fakeSigner, axiosInstance, apiAuthMode: 'AWS_IAM', rememberMe: false });
    // make user appear logged in by setting a dummy token
    authIam2.setToken(JSON.stringify({ IdToken: 't', RefreshToken: 'r' }));
    // stub credentials to return valid STS creds
    const creds = { accessKeyId: 'x', secretAccessKey: 'y', sessionToken: 'z', expiration: new Date(Date.now() + 1000) };
    jest.spyOn(authIam2, 'getCachedCredentials').mockResolvedValue(creds);
    // stub signer
    fakeSigner.signedHeaders = jest.fn().mockResolvedValue({ 'X-Hdr': 'val' });
    const config: any = { method: 'GET', url: '/x', baseURL: '', params: {}, data: null, headers: {} };
    await authIam2.requestHeaders(config);
    expect(fakeSigner.signedHeaders).toHaveBeenCalled();
    expect(config.headers[ 'X-Hdr' ]).toBe('val');
  });

  it('requestHeaders skips AWS_IAM signing for auth endpoints', async () => {
    const authIam3 = useAWSAuthenticator({ 
      requestSigner: fakeSigner, 
      axiosInstance, 
      apiAuthMode: 'AWS_IAM', 
      awsTempCredentialsApiEndPoint: '/mauth/getCredentials',
      refreshTokenApiEndPoint: '/mauth/refreshToken',
      rememberMe: false 
    });
    // make user appear logged in
    authIam3.setToken(JSON.stringify({ IdToken: 't', RefreshToken: 'r' }));
    // stub signer to track calls
    fakeSigner.signedHeaders = jest.fn().mockResolvedValue({ 'X-Hdr': 'val' });
    
    // Test credentials endpoint - should NOT be signed
    const credsConfig: any = { method: 'POST', url: '/mauth/getCredentials/', baseURL: 'https://api.example.com', data: { idToken: 't' }, headers: {} };
    await authIam3.requestHeaders(credsConfig);
    expect(fakeSigner.signedHeaders).not.toHaveBeenCalled();
    
    // Test refresh token endpoint - should NOT be signed
    fakeSigner.signedHeaders = jest.fn().mockResolvedValue({ 'X-Hdr': 'val' });
    const refreshConfig: any = { method: 'POST', url: '/mauth/refreshToken/', baseURL: 'https://api.example.com', data: { refreshToken: 'r' }, headers: {} };
    await authIam3.requestHeaders(refreshConfig);
    expect(fakeSigner.signedHeaders).not.toHaveBeenCalled();
    
    // Test regular endpoint - SHOULD be signed
    fakeSigner.signedHeaders = jest.fn().mockResolvedValue({ 'X-Hdr': 'val' });
    const creds = { accessKeyId: 'x', secretAccessKey: 'y', sessionToken: 'z', expiration: new Date(Date.now() + 1000) };
    jest.spyOn(authIam3, 'getCachedCredentials').mockResolvedValue(creds);
    const normalConfig: any = { method: 'GET', url: '/api/data', baseURL: 'https://api.example.com', params: {}, headers: {} };
    await authIam3.requestHeaders(normalConfig);
    expect(fakeSigner.signedHeaders).toHaveBeenCalled();
  });
});

describe('Credential Refresh Flow - Critical Scenarios', () => {
  let authIam: ReturnType<typeof useAWSAuthenticator>;
  
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
    authIam = useAWSAuthenticator({
      requestSigner: fakeSigner,
      axiosInstance,
      apiAuthMode: 'AWS_IAM',
      awsTempCredentialsApiEndPoint: '/mauth/getCredentials',
      refreshTokenApiEndPoint: '/mauth/refreshToken',
      rememberMe: false,
    });
  });

  it('getCredentials returns cached credentials when valid', async () => {
    const expirationDate = new Date(Date.now() + 900000);
    const validCreds = { 
      accessKeyId: 'key1', 
      secretAccessKey: 'secret1', 
      sessionToken: 'token1', 
      expiration: expirationDate // 15 minutes in future
    };
    authIam.setCredentials(validCreds);
    
    const result = await authIam.getCredentials();
    // Note: expiration is stringified when stored and retrieved from cache
    expect(result.accessKeyId).toBe('key1');
    expect(result.secretAccessKey).toBe('secret1');
    expect(result.sessionToken).toBe('token1');
    expect(new Date(result.expiration).getTime()).toBe(expirationDate.getTime());
  });

  it('getCredentials fetches new credentials when cache is empty', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'valid-id-token', RefreshToken: 'refresh-token' }));
    
    const newCreds = { 
      AccessKeyId: 'newkey', 
      SecretKey: 'newsecret', 
      SessionToken: 'newtoken', 
      Expiration: new Date(Date.now() + 900000).toISOString()
    };
    
    axiosInstance.post = jest.fn().mockResolvedValue({
      data: { Credentials: newCreds }
    }) as any;
    
    const result = await authIam.getCredentials();
    
    expect(axiosInstance.post).toHaveBeenCalledWith('/mauth/getCredentials/', { idToken: 'valid-id-token' });
    expect(result.accessKeyId).toBe('newkey');
    expect(result.secretAccessKey).toBe('newsecret');
  });

  it('getCredentials fetches new credentials when cached ones are expired', async () => {
    // Set expired credentials
    const expiredCreds = { 
      accessKeyId: 'oldkey', 
      secretAccessKey: 'oldsecret', 
      sessionToken: 'oldtoken', 
      expiration: new Date(Date.now() - 1000) // expired 1 second ago
    };
    authIam.setCredentials(expiredCreds);
    authIam.setToken(JSON.stringify({ IdToken: 'valid-id-token', RefreshToken: 'refresh-token' }));
    
    const newCreds = { 
      AccessKeyId: 'newkey', 
      SecretKey: 'newsecret', 
      SessionToken: 'newtoken', 
      Expiration: new Date(Date.now() + 900000).toISOString()
    };
    
    axiosInstance.post = jest.fn().mockResolvedValue({
      data: { Credentials: newCreds }
    }) as any;
    
    const result = await authIam.getCredentials();
    
    expect(axiosInstance.post).toHaveBeenCalled();
    expect(result.accessKeyId).toBe('newkey');
  });

  it('refreshAuth clears cached credentials and fetches new ones', async () => {
    const oldCreds = { 
      accessKeyId: 'oldkey', 
      secretAccessKey: 'oldsecret', 
      sessionToken: 'oldtoken', 
      expiration: new Date(Date.now() + 900000)
    };
    authIam.setCredentials(oldCreds);
    authIam.setToken(JSON.stringify({ IdToken: 'valid-id-token', RefreshToken: 'refresh-token' }));
    
    const newCreds = { 
      AccessKeyId: 'newkey', 
      SecretKey: 'newsecret', 
      SessionToken: 'newtoken', 
      Expiration: new Date(Date.now() + 900000).toISOString()
    };
    
    axiosInstance.post = jest.fn().mockResolvedValue({
      data: { Credentials: newCreds }
    }) as any;
    
    await authIam.refreshAuth();
    
    // Should have cleared old credentials and fetched new ones
    expect(axiosInstance.post).toHaveBeenCalledWith('/mauth/getCredentials/', { idToken: 'valid-id-token' });
  });

  it('fetches new credentials and refreshes IdToken when credentials endpoint returns 401', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'expired-id-token', RefreshToken: 'valid-refresh-token' }));
    
    const refreshedTokens = { 
      IdToken: 'new-id-token', 
      RefreshToken: 'valid-refresh-token', 
      AccessToken: 'new-access-token',
      ExpiresIn: 3600,
      TokenType: 'Bearer'
    };
    
    const newCreds = { 
      AccessKeyId: 'newkey', 
      SecretKey: 'newsecret', 
      SessionToken: 'newtoken', 
      Expiration: new Date(Date.now() + 900000).toISOString()
    };
    
    // First call fails with 401, second call succeeds
    axiosInstance.post = jest.fn()
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: refreshedTokens }) // refresh token call
      .mockResolvedValueOnce({ data: { Credentials: newCreds } }) as any; // get credentials call
    
    const result = await authIam.getCredentials();
    
    // Should have called refresh token endpoint
    expect(axiosInstance.post).toHaveBeenCalledWith('/mauth/refreshToken/', { refreshToken: 'valid-refresh-token' });
    // Should have called credentials endpoint twice (once failed, once succeeded)
    expect((axiosInstance.post as jest.Mock).mock.calls.filter(c => c[0] === '/mauth/getCredentials/').length).toBe(2);
    // Should have new credentials
    expect(result.accessKeyId).toBe('newkey');
    // Should have updated token in storage
    expect(authIam.getToken()).toBe('new-id-token');
  });

  it('logs out when refresh token is expired (401 from refresh endpoint)', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'expired-id-token', RefreshToken: 'expired-refresh-token' }));
    
    const logoutSpy = jest.spyOn(authIam, 'logout');
    
    // First call to credentials fails with 401
    // Second call to refresh token also fails with 401
    axiosInstance.post = jest.fn()
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockRejectedValueOnce({ response: { status: 401 } }) as any;
    
    await expect(authIam.getCredentials()).rejects.toThrow();
    
    // Should have called logout
    expect(logoutSpy).toHaveBeenCalled();
    // Should have cleared tokens
    expect(authIam.getToken()).toBeUndefined();
  });

  it('logs out on non-401/403 errors from credentials endpoint', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'valid-id-token', RefreshToken: 'valid-refresh-token' }));
    
    const logoutSpy = jest.spyOn(authIam, 'logout');
    
    const errorObj = { 
      response: { status: 500 },
      message: 'Internal server error'
    };
    axiosInstance.post = jest.fn().mockRejectedValueOnce(errorObj) as any;
    
    await expect(authIam.getCredentials()).rejects.toEqual(errorObj);
    
    expect(logoutSpy).toHaveBeenCalled();
  });

  it('prevents circular dependency - credentials endpoint is not signed with AWS IAM', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'valid-id-token', RefreshToken: 'refresh-token' }));
    
    const newCreds = { 
      AccessKeyId: 'newkey', 
      SecretKey: 'newsecret', 
      SessionToken: 'newtoken', 
      Expiration: new Date(Date.now() + 900000).toISOString()
    };
    
    // Track if requestHeaders is called during credential fetch
    let requestHeadersCalled = false;
    const originalRequestHeaders = authIam.requestHeaders;
    authIam.requestHeaders = jest.fn(async (config: any) => {
      requestHeadersCalled = true;
      return originalRequestHeaders.call(authIam, config);
    }) as any;
    
    fakeSigner.signedHeaders = jest.fn().mockResolvedValue({ 'X-Hdr': 'val' });
    
    axiosInstance.post = jest.fn().mockResolvedValue({
      data: { Credentials: newCreds }
    }) as any;
    
    await authIam.getCredentials();
    
    // requestHeaders should have been called, but signer should NOT have been called
    // (because it's an auth endpoint)
    expect(fakeSigner.signedHeaders).not.toHaveBeenCalled();
  });

  it('handles 403 error same as 401 (triggers IdToken refresh)', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'expired-id-token', RefreshToken: 'valid-refresh-token' }));
    
    const refreshedTokens = { 
      IdToken: 'new-id-token', 
      RefreshToken: 'valid-refresh-token', 
      AccessToken: 'new-access-token',
      ExpiresIn: 3600,
      TokenType: 'Bearer'
    };
    
    const newCreds = { 
      AccessKeyId: 'newkey', 
      SecretKey: 'newsecret', 
      SessionToken: 'newtoken', 
      Expiration: new Date(Date.now() + 900000).toISOString()
    };
    
    // First call fails with 403, second call succeeds
    axiosInstance.post = jest.fn()
      .mockRejectedValueOnce({ response: { status: 403 } })
      .mockResolvedValueOnce({ data: refreshedTokens })
      .mockResolvedValueOnce({ data: { Credentials: newCreds } }) as any;
    
    const result = await authIam.getCredentials();
    
    expect(axiosInstance.post).toHaveBeenCalledWith('/mauth/refreshToken/', { refreshToken: 'valid-refresh-token' });
    expect(result.accessKeyId).toBe('newkey');
    expect(authIam.getToken()).toBe('new-id-token');
  });

  it('credentials within 5 second buffer are considered expired', async () => {
    // Credentials expiring in 3 seconds (within 5 second buffer)
    const almostExpiredCreds = { 
      accessKeyId: 'oldkey', 
      secretAccessKey: 'oldsecret', 
      sessionToken: 'oldtoken', 
      expiration: new Date(Date.now() + 3000) // expires in 3 seconds
    };
    
    expect(authIam.isValidCredentials(almostExpiredCreds)).toBe(false);
    
    // Credentials expiring in 10 seconds (outside 5 second buffer)
    const validCreds = { 
      accessKeyId: 'key', 
      secretAccessKey: 'secret', 
      sessionToken: 'token', 
      expiration: new Date(Date.now() + 10000) // expires in 10 seconds
    };
    
    expect(authIam.isValidCredentials(validCreds)).toBe(true);
  });

  it('handles network timeout errors gracefully', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'valid-id-token', RefreshToken: 'valid-refresh-token' }));
    
    const logoutSpy = jest.spyOn(authIam, 'logout');
    
    // Simulate network timeout (no response object)
    const timeoutError = { 
      message: 'Network timeout',
      code: 'ECONNABORTED'
    };
    axiosInstance.post = jest.fn().mockRejectedValueOnce(timeoutError) as any;
    
    await expect(authIam.getCredentials()).rejects.toEqual(timeoutError);
    
    expect(logoutSpy).toHaveBeenCalled();
  });

  it('handles malformed credentials response', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'valid-id-token', RefreshToken: 'valid-refresh-token' }));
    
    const logoutSpy = jest.spyOn(authIam, 'logout');
    
    // Response is missing Credentials field
    axiosInstance.post = jest.fn().mockResolvedValue({
      data: { } // Missing Credentials
    }) as any;
    
    await expect(authIam.getCredentials()).rejects.toThrow('No credentials returned');
    
    expect(logoutSpy).toHaveBeenCalled();
  });

  it('handles credentials with missing required fields', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'valid-id-token', RefreshToken: 'valid-refresh-token' }));
    
    // Credentials missing SessionToken
    const incompleteCreds = { 
      AccessKeyId: 'key', 
      SecretKey: 'secret',
      // Missing SessionToken
      Expiration: new Date(Date.now() + 900000).toISOString()
    };
    
    axiosInstance.post = jest.fn().mockResolvedValue({
      data: { Credentials: incompleteCreds }
    }) as any;
    
    const result = await authIam.getCredentials();
    
    // Should still work, but sessionToken will be undefined
    expect(result.accessKeyId).toBe('key');
    expect(result.secretAccessKey).toBe('secret');
  });

  it('does not attempt IdToken refresh if no refresh token is available', async () => {
    // Set token without RefreshToken
    authIam.setToken(JSON.stringify({ IdToken: 'expired-id-token' }));
    
    const logoutSpy = jest.spyOn(authIam, 'logout');
    
    axiosInstance.post = jest.fn().mockRejectedValueOnce({ 
      response: { status: 401 }
    }) as any;
    
    await expect(authIam.getCredentials()).rejects.toThrow();
    
    // Should logout immediately without attempting refresh
    expect(logoutSpy).toHaveBeenCalled();
  });

  it('handles credentials with no expiration (edge case)', async () => {
    const noExpirationCreds = { 
      accessKeyId: 'key', 
      secretAccessKey: 'secret', 
      sessionToken: 'token'
      // No expiration field
    };
    
    // Credentials without expiration should be considered valid
    expect(authIam.isValidCredentials(noExpirationCreds as any)).toBe(true);
  });

  it('clears credentials when logout is called', () => {
    const creds = { 
      accessKeyId: 'key', 
      secretAccessKey: 'secret', 
      sessionToken: 'token', 
      expiration: new Date(Date.now() + 900000)
    };
    authIam.setCredentials(creds);
    authIam.setToken(JSON.stringify({ IdToken: 'token', RefreshToken: 'refresh' }));
    
    authIam.logout();
    
    expect(authIam.getToken()).toBeUndefined();
    expect(authIam.getRefreshToken()).toBeUndefined();
  });

  it('handles empty string responses from API', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'valid-id-token', RefreshToken: 'refresh' }));
    
    const logoutSpy = jest.spyOn(authIam, 'logout');
    
    axiosInstance.post = jest.fn().mockResolvedValue({
      data: ''
    }) as any;
    
    await expect(authIam.getCredentials()).rejects.toThrow();
    expect(logoutSpy).toHaveBeenCalled();
  });
});

describe('Integration Tests with ApiContext Pattern', () => {
  let authIam: ReturnType<typeof useAWSAuthenticator>;
  
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
    authIam = useAWSAuthenticator({
      requestSigner: fakeSigner,
      axiosInstance,
      apiAuthMode: 'AWS_IAM',
      awsTempCredentialsApiEndPoint: '/mauth/getCredentials',
      refreshTokenApiEndPoint: '/mauth/refreshToken',
      rememberMe: false,
    });
  });

  it('shouldRefreshAuth returns true for 401 errors', () => {
    const error401: any = { response: { status: 401 } };
    expect(authIam.shouldRefreshAuth(error401)).toBe(true);
  });

  it('shouldRefreshAuth returns true for 403 errors', () => {
    const error403: any = { response: { status: 403 } };
    expect(authIam.shouldRefreshAuth(error403)).toBe(true);
  });

  it('shouldRefreshAuth returns false for other errors', () => {
    const error500: any = { response: { status: 500 } };
    expect(authIam.shouldRefreshAuth(error500)).toBe(false);
    
    const error404: any = { response: { status: 404 } };
    expect(authIam.shouldRefreshAuth(error404)).toBe(false);
  });

  it('refreshAuth works as expected by API interceptor', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'valid-id-token', RefreshToken: 'refresh-token' }));
    
    const newCreds = { 
      AccessKeyId: 'newkey', 
      SecretKey: 'newsecret', 
      SessionToken: 'newtoken', 
      Expiration: new Date(Date.now() + 900000).toISOString()
    };
    
    axiosInstance.post = jest.fn().mockResolvedValue({
      data: { Credentials: newCreds }
    }) as any;
    
    // This is how ApiContext calls it
    await authIam.refreshAuth();
    
    // Should not throw and should have fetched new credentials
    expect(axiosInstance.post).toHaveBeenCalledWith('/mauth/getCredentials/', { idToken: 'valid-id-token' });
  });

  it('refreshAuth throws and calls logout on failure', async () => {
    authIam.setToken(JSON.stringify({ IdToken: 'expired', RefreshToken: 'expired' }));
    
    const logoutSpy = jest.spyOn(authIam, 'logout');
    
    axiosInstance.post = jest.fn()
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockRejectedValueOnce({ response: { status: 401 } }) as any;
    
    await expect(authIam.refreshAuth()).rejects.toThrow();
    expect(logoutSpy).toHaveBeenCalled();
  });
}); 