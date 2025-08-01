import { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Defines the contract for an authentication provider.
 * This interface allows for different authentication strategies (e.g., localStorage, AWS Cognito)
 * to be used interchangeably by the application's API layer.
 */
export interface IAuthProvider {
  /**
   * Stores the authentication token data.
   * @param token - The token object or string to be stored. Can be null to clear.
   */
  setToken(token: string | null | object): void;

  /**
   * Removes the authentication token from storage.
   * @deprecated The `logout` method is preferred for clarity.
   */
  removeToken(): void;

  /**
   * Retrieves the primary authentication token (e.g., IdToken).
   * @returns The token string, or null if not available.
   */
  getToken(): string | null;

  /**
   * Retrieves the refresh token, if applicable.
   * @returns The refresh token string, or null if not available.
   */
  getRefreshToken(): string | null;

  /**
   * Manually triggers a token refresh.
   * @deprecated The `refreshAuth` hook is preferred as it's used by the API interceptor.
   * @returns A promise that resolves to the new token, or null on failure.
   */
  refreshToken(): Promise<string | null>;

  /**
   * Processes a response (typically from a login endpoint) to extract and store the token.
   * @param response - The response object.
   * @returns `true` if a token was successfully processed, `false` otherwise.
   */
  processToken(response: any): boolean;

  /**
   * Applies authentication headers to a request configuration.
   * @deprecated The `authenticateRequest` hook is preferred as it's used by the API interceptor.
   * @param config - The Axios request configuration to be modified.
   */
  requestHeaders(config: InternalAxiosRequestConfig<any>): void;

  /**
   * The primary hook for the API request interceptor.
   * It should apply all necessary authentication (e.g., headers, signing) to the request.
   * @param config - The outgoing Axios request configuration.
   * @returns A promise that resolves with the modified configuration.
   */
  authenticateRequest?(config: InternalAxiosRequestConfig<any>): Promise<InternalAxiosRequestConfig<any>>;

  /**
   * The primary hook for the API response interceptor.
   * It can inspect responses for authentication-related data (e.g., updated tokens).
   * @param response - The incoming Axios response.
   */
  processResponse?(response: AxiosResponse<any>): void;

  /**
   * The primary hook for the API error interceptor.
   * Determines if a given API error should trigger an authentication refresh.
   * @param error - The Axios error.
   * @param config - The original request configuration.
   * @returns `true` if an auth refresh should be attempted.
   */
  shouldRefreshAuth?(error: any, config?: InternalAxiosRequestConfig<any>): boolean;

  /**
   * The primary hook for the API error interceptor.
   * Executes the full authentication refresh logic (e.g., refreshing tokens and/or credentials).
   * @returns A promise that resolves on success and rejects on failure.
   */
  refreshAuth?(): Promise<void>;

  /**
   * Clears all authentication-related data from storage and logs the user out.
   */
  logout?(): void;
}