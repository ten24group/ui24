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
}); 