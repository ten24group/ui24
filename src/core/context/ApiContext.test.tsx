import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import React from 'react';
import { render, act } from '@testing-library/react';
import { ApiProvider, useApi } from './ApiContext';
import { Ui24ConfigProvider } from './UI24Context';
import '@testing-library/jest-dom';

// Mock axios.create to use a shared instance for interceptors
const originalAxios = jest.requireActual('axios');
const mockInstance = originalAxios.create();
jest.mock('axios', () => ({
  ...jest.requireActual('axios'),
  create: () => mockInstance,
}));

// Create a fake auth provider to spy on hooks
const authenticateRequest = jest.fn(async cfg => cfg);
const processResponse = jest.fn();
const shouldRefreshAuth = jest.fn((error) => {
  const status = error.response?.status;
  return status === 401 || status === 403;
});
const refreshAuth = jest.fn(async () => { });
const logout = jest.fn();

jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    authenticateRequest,
    processResponse,
    shouldRefreshAuth,
    refreshAuth,
    logout,
    // Legacy hooks stubbed
    setToken: jest.fn(),
    removeToken: jest.fn(),
    getToken: jest.fn(),
    getRefreshToken: jest.fn(),
    processToken: jest.fn(),
    requestHeaders: jest.fn(),
    refreshToken: jest.fn(),
  })
}));

let callApiMethod;
function TestComp() {
  const api = useApi();
  React.useEffect(() => { callApiMethod = api.callApiMethod; }, [ api ]);
  return null;
}

// Dummy UI24 config for testing
const dummyUi24Config = {
  baseURL: '',
  appURLPrefix: '',
  appLogo: '',
  companyName: '',
  uiConfig: {
    auth: {},
    menu: {},
    pages: {},
    dashboard: {}
  },
  appName: 'test'
};

describe('ApiContext interceptors', () => {
  beforeEach(() => {
    authenticateRequest.mockClear();
    processResponse.mockClear();
    shouldRefreshAuth.mockClear();
    refreshAuth.mockClear();
    logout.mockClear();
    new MockAdapter(mockInstance).reset();
  });

  it('retries once on 401 then succeeds', async () => {
    const mock = new MockAdapter(mockInstance);
    mock.onGet('/test').replyOnce(401).onGet('/test').reply(200);

    await act(async () => {
      render(
        <Ui24ConfigProvider initConfig={dummyUi24Config as any}>
          <ApiProvider><TestComp /></ApiProvider>
        </Ui24ConfigProvider>
      );
    });

    const resp = await callApiMethod({ apiUrl: '/test', apiMethod: 'GET' });

    expect(resp.status).toBe(200);
    expect(shouldRefreshAuth).toHaveBeenCalled();
    expect(refreshAuth).toHaveBeenCalledTimes(1);
    expect(authenticateRequest).toHaveBeenCalledTimes(3);
  });

  it('fails without retry on non-auth errors', async () => {
    const mock = new MockAdapter(mockInstance);
    mock.onGet('/fail').reply(500);

    await act(async () => {
      render(
        <Ui24ConfigProvider initConfig={dummyUi24Config as any}>
          <ApiProvider><TestComp /></ApiProvider>
        </Ui24ConfigProvider>
      );
    });

    await expect(callApiMethod({ apiUrl: '/fail', apiMethod: 'GET' })).rejects.toBeDefined();
    expect(refreshAuth).not.toHaveBeenCalled();
  });
}); 