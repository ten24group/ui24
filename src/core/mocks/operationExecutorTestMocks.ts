import { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { randomUUID } from './mockUtils';

/**
 * Mock API Responses for OperationExecutor Tests
 * 
 * This interceptor catches test API calls and returns mock responses
 * so testing can be done WITHOUT backend deployment.
 */

export function setupOperationExecutorTestMocks(axiosInstance: AxiosInstance) {
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const url = config.url || '';

      // Only intercept test endpoints
      if (!url.includes('/test/operation-executor/')) {
        return config;
      }

      console.log('[MOCK] Intercepted test endpoint:', url);

      // Extract the test type from URL
      const testType = url.split('/test/operation-executor/')[ 1 ]?.split('?')[ 0 ];
      console.log('[MOCK] Test type:', testType);

      // Get request body - handle both string and object formats
      let body: any = {};
      if (config.data) {
        if (typeof config.data === 'string') {
          try {
            body = JSON.parse(config.data);
          } catch (e) {
            console.error('[MOCK] Failed to parse request body:', config.data);
            body = {};
          }
        } else {
          body = config.data;
        }
      }

      // Generate mock response based on test type
      let mockResponse: any;

      switch (testType) {
        case 'response-modal-basic':
          mockResponse = {
            success: true,
            message: 'Test 1 completed successfully!',
            testMessage: body.testMessage,
            timestamp: new Date().toISOString(),
            details: {
              receivedMessage: body.testMessage,
              processedBy: 'MockOperationExecutorTestController',
              testCase: 'response-modal-basic'
            }
          };
          break;

        case 'response-modal-width':
          mockResponse = {
            success: true,
            message: 'Test 2: Custom width response modal',
            data: {
              originalInput: body.testData,
              processedData: body.testData?.toUpperCase(),
              metadata: {
                length: body.testData?.length,
                wordCount: body.testData?.split(' ').length,
                timestamp: new Date().toISOString()
              },
              analysis: {
                hasNumbers: /\d/.test(body.testData || ''),
                hasSpecialChars: /[^a-zA-Z0-9\s]/.test(body.testData || ''),
                isUpperCase: body.testData === body.testData?.toUpperCase(),
                isLowerCase: body.testData === body.testData?.toLowerCase()
              },
              additionalInfo: 'This response modal should be 1000px wide to accommodate all this data properly.'
            }
          };
          break;

        case 'response-modal-refresh':
          mockResponse = {
            success: true,
            message: `Item "${body.itemName}" created successfully!`,
            itemId: randomUUID(),
            itemName: body.itemName,
            createdAt: new Date().toISOString(),
            note: 'After closing this modal, the parent table should refresh automatically.'
          };
          break;

        case 'submit-redirect-static':
          mockResponse = {
            success: true,
            message: `Action type "${body.actionType}" processed. Redirecting to /system...`,
            actionType: body.actionType,
            processedAt: new Date().toISOString()
          };
          break;

        case 'submit-redirect-dynamic':
          mockResponse = {
            success: true,
            message: `User "${body.username}" created. Redirecting to user view...`,
            userId: randomUUID(),
            username: body.username,
            email: body.email,
            createdAt: new Date().toISOString()
          };
          break;

        case 'submit-redirect-response':
          const redirectMap: Record<string, string> = {
            users: '/list-user',
            teams: '/list-team',
            system: '/system'
          };
          const redirectUrl = redirectMap[ body.destination ] || '/';
          mockResponse = {
            success: true,
            message: `Redirecting to ${redirectUrl}...`,
            redirectUrl,
            destination: body.destination,
            processedAt: new Date().toISOString()
          };
          break;

        case 'validation-errors':
          const errors: Array<{ path: string[]; message: string }> = [];

          // Validate email
          if (!body.email) {
            errors.push({ path: [ 'email' ], message: 'Email is required' });
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            errors.push({ path: [ 'email' ], message: 'Email must be valid' });
          }

          // Validate age
          if (!body.age) {
            errors.push({ path: [ 'age' ], message: 'Age is required' });
          } else if (body.age < 18 || body.age > 100) {
            errors.push({ path: [ 'age' ], message: 'Age must be between 18 and 100' });
          }

          // Validate username
          if (!body.username) {
            errors.push({ path: [ 'username' ], message: 'Username is required' });
          } else if (body.username.length < 5) {
            errors.push({ path: [ 'username' ], message: 'Username must be at least 5 characters' });
          }

          if (errors.length > 0) {
            // Return error response
            const errorResponse: AxiosResponse = {
              data: {
                success: false,
                message: 'Validation failed',
                errors
              },
              status: 400,
              statusText: 'Bad Request',
              headers: {},
              config: config as any
            };
            return Promise.reject({ response: errorResponse, config });
          }

          mockResponse = {
            success: true,
            message: 'All validations passed!',
            data: {
              email: body.email,
              age: body.age,
              username: body.username,
              validatedAt: new Date().toISOString()
            }
          };
          break;

        case 'no-duplicate-toasts':
          mockResponse = {
            success: true,
            message: 'Check: You should see ONLY ONE success toast',
            action: body.action,
            timestamp: new Date().toISOString(),
            note: 'If you see multiple toasts, there is a bug in OperationExecutor or component integration.'
          };
          break;

        case 'modal-closing':
          mockResponse = {
            success: true,
            message: 'Close this response modal first',
            instructions: [
              '1. You are currently viewing the response modal',
              '2. Click the X or Cancel button on this modal',
              '3. The parent modal should then close automatically',
              '4. If parent modal does not close, there is a bug'
            ],
            closeTest: body.closeTest,
            timestamp: new Date().toISOString()
          };
          break;

        case 'chaining-step1':
          mockResponse = {
            success: true,
            message: 'Step 1 complete!',
            step1Data: body.step1Data,
            step1Timestamp: new Date().toISOString(),

            // Config for Step 2
            nextStep: {
              showModal: true,
              modalTitle: 'Step 2 of 3',
              pageType: 'form',
              pageConfig: {
                title: '✅ Test 10: Step 2 of 3',
                helpText: 'Step 2: Enter additional data. Will chain to Step 3.',
                propertiesConfig: [
                  {
                    name: 'step2Data',
                    label: 'Step 2 Data',
                    column: 'step2Data',
                    fieldType: 'text',
                    required: true,
                    defaultValue: `Continuing from: ${body.step1Data}`
                  }
                ],
                apiConfig: {
                  apiMethod: 'POST',
                  apiUrl: '/admin/test/operation-executor/chaining-step2',
                  responseKey: ''
                },
                formButtons: [ 'submit', 'cancel' ],
                dynamicConfigKey: 'nextStep'
              }
            }
          };
          break;

        case 'chaining-step2':
          mockResponse = {
            success: true,
            message: 'Step 2 complete!',
            step2Data: body.step2Data,
            step2Timestamp: new Date().toISOString(),

            // Config for Step 3 (final)
            nextStep: {
              showModal: true,
              modalTitle: 'Step 3 of 3 (Final)',
              pageType: 'form',
              pageConfig: {
                title: '✅ Test 10: Step 3 of 3 (Final)',
                helpText: 'Final step: Enter final data and complete the chain.',
                propertiesConfig: [
                  {
                    name: 'step3Data',
                    label: 'Step 3 Data',
                    column: 'step3Data',
                    fieldType: 'text',
                    required: true,
                    defaultValue: `Continuing from: ${body.step2Data}`
                  }
                ],
                apiConfig: {
                  apiMethod: 'POST',
                  apiUrl: '/admin/test/operation-executor/chaining-step3',
                  responseKey: ''
                },
                formButtons: [ 'submit', 'cancel' ]
              },
              responseConfig: {
                showModal: true,
                modalTitle: 'All Steps Complete!'
              }
            }
          };
          break;

        case 'chaining-step3':
          mockResponse = {
            success: true,
            message: '🎉 All 3 steps completed successfully!',
            step3Data: body.step3Data,
            step3Timestamp: new Date().toISOString(),
            summary: {
              totalSteps: 3,
              completedAt: new Date().toISOString(),
              note: 'Chaining operation test complete. This is the final step with no further chaining.'
            }
          };
          break;

        case 'drawer-test':
          mockResponse = {
            success: true,
            message: 'Drawer test completed!',
            drawerTest: body.drawerTest,
            timestamp: new Date().toISOString(),
            note: 'This response modal appeared from within a drawer. Both drawer and modal should work correctly.'
          };
          break;

        case 'multiple-modals':
          const currentCycle = body.currentCycle || 1;
          const totalCycles = body.cycles;

          if (currentCycle >= totalCycles) {
            // Final cycle
            mockResponse = {
              success: true,
              message: `🎉 All ${totalCycles} cycles completed!`,
              currentCycle,
              totalCycles,
              timestamp: new Date().toISOString(),
              summary: 'All response modals completed. Each modal should have updated content, not stacked.'
            };
          } else {
            // More cycles remaining
            mockResponse = {
              success: true,
              message: `Cycle ${currentCycle} of ${totalCycles} complete`,
              currentCycle,
              totalCycles,
              timestamp: new Date().toISOString(),

              // Config for next cycle
              nextStep: {
                showModal: true,
                modalTitle: `Cycle ${currentCycle + 1} of ${totalCycles}`,
                pageType: 'form',
                pageConfig: {
                  title: `✅ Test 12: Cycle ${currentCycle + 1} of ${totalCycles}`,
                  helpText: `This is cycle ${currentCycle + 1}. Modal content should update, not stack.`,
                  propertiesConfig: [
                    {
                      name: 'cycles',
                      label: 'Total Cycles',
                      column: 'cycles',
                      fieldType: 'number',
                      required: true,
                      defaultValue: totalCycles,
                      disabled: true
                    },
                    {
                      name: 'currentCycle',
                      label: 'Current Cycle',
                      column: 'currentCycle',
                      fieldType: 'number',
                      required: true,
                      defaultValue: currentCycle + 1,
                      disabled: true
                    }
                  ],
                  apiConfig: {
                    apiMethod: 'POST',
                    apiUrl: '/admin/test/operation-executor/multiple-modals',
                    responseKey: ''
                  },
                  formButtons: [ 'submit', 'cancel' ],
                  dynamicConfigKey: 'nextStep' // CRITICAL: Enable chaining for next cycle
                }
              }
            };
          }
          break;

        default:
          // Unknown test type, let it pass through to real API
          return config;
      }

      // Create mock response and short-circuit the request
      const mockAxiosResponse: AxiosResponse = {
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json'
        },
        config: config as any
      };

      console.log('[MOCK] Returning mock response:', mockResponse);

      // Return a promise that immediately resolves with mock response
      // We need to throw a special object that the response interceptor will catch
      return Promise.reject({
        __isMockResponse: true,
        response: mockAxiosResponse,
        config
      });
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle mock responses
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      // If this is a mock response, resolve it instead of rejecting
      if (error.__isMockResponse) {
        console.log('[MOCK] Response interceptor caught mock response, resolving...');
        return Promise.resolve(error.response);
      }
      return Promise.reject(error);
    }
  );
}
