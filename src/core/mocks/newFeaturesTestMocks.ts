import { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { randomUUID } from './mockUtils';

/**
 * Mock API Responses for New Features Tests
 * 
 * This interceptor catches new features test API calls and returns mock responses
 * so testing can be done WITHOUT backend deployment.
 * 
 * Tests:
 * - Code Editor (JSON, Handlebars, Markdown)
 * - Form Wizard (basic, with code editor, in drawer)
 */

export function setupNewFeaturesTestMocks(axiosInstance: AxiosInstance) {
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const url = config.url || '';

      // Only intercept test endpoints
      if (!url.includes('/test/new-features/')) {
        return config;
      }

      console.log('[MOCK] Intercepted new features test endpoint:', url);

      // Extract the test type from URL
      const testType = url.split('/test/new-features/')[ 1 ]?.split('?')[ 0 ];
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
        // ============================================
        // CODE EDITOR TESTS
        // ============================================

        case 'code-editor-json':
          // body.configData is already an object (parsed from JSON string by the form)
          mockResponse = {
            success: true,
            message: 'JSON configuration saved successfully!',
            configId: randomUUID(),
            configData: body.configData,
            description: body.description,
            validation: {
              isValidJSON: true,
              parsedKeys: body.configData ? Object.keys(body.configData) : [],
              size: JSON.stringify(body.configData)?.length || 0
            },
            savedAt: new Date().toISOString()
          };
          break;

        case 'code-editor-handlebars':
          mockResponse = {
            success: true,
            message: `Template "${body.templateName}" saved successfully!`,
            templateId: randomUUID(),
            templateName: body.templateName,
            templateContent: body.templateContent,
            analysis: {
              lineCount: body.templateContent?.split('\n').length || 0,
              variableCount: (body.templateContent?.match(/\{\{.*?\}\}/g) || []).length,
              variables: (body.templateContent?.match(/\{\{(.*?)\}\}/g) || []).map(
                (v: string) => v.replace(/\{\{|\}\}/g, '').trim()
              ),
              hasPartials: body.templateContent?.includes('{{>') || false,
              hasHelpers: body.templateContent?.includes('{{#') || false
            },
            savedAt: new Date().toISOString()
          };
          break;

        case 'code-editor-markdown':
          mockResponse = {
            success: true,
            message: `Document "${body.title}" saved successfully!`,
            documentId: randomUUID(),
            title: body.title,
            markdownContent: body.markdownContent,
            analysis: {
              lineCount: body.markdownContent?.split('\n').length || 0,
              wordCount: body.markdownContent?.split(/\s+/).length || 0,
              headingCount: (body.markdownContent?.match(/^#{1,6}\s/gm) || []).length,
              linkCount: (body.markdownContent?.match(/\[.*?\]\(.*?\)/g) || []).length,
              codeBlockCount: (body.markdownContent?.match(/```[\s\S]*?```/g) || []).length,
              listItemCount: (body.markdownContent?.match(/^[-*+]\s/gm) || []).length
            },
            savedAt: new Date().toISOString()
          };
          break;

        case 'code-editor-all-options':
          mockResponse = {
            success: true,
            message: 'JavaScript script saved successfully!',
            scriptId: randomUUID(),
            scriptCode: body.scriptCode,
            analysis: {
              lineCount: body.scriptCode?.split('\n').length || 0,
              characterCount: body.scriptCode?.length || 0,
              functionCount: (body.scriptCode?.match(/function\s+\w+/g) || []).length,
              arrowFunctionCount: (body.scriptCode?.match(/=>\s*\{/g) || []).length,
              hasAsync: body.scriptCode?.includes('async') || false,
              hasAwait: body.scriptCode?.includes('await') || false,
              hasImports: body.scriptCode?.includes('import') || false,
              hasExports: body.scriptCode?.includes('export') || false
            },
            savedAt: new Date().toISOString()
          };
          break;

        // ============================================
        // WIZARD TESTS
        // ============================================

        case 'wizard-basic':
          mockResponse = {
            success: true,
            message: `Registration completed successfully for ${body.firstName} ${body.lastName}!`,
            userId: randomUUID(),
            profile: {
              firstName: body.firstName,
              lastName: body.lastName,
              email: body.email,
              fullName: `${body.firstName} ${body.lastName}`
            },
            preferences: {
              theme: body.theme,
              notifications: body.notifications !== undefined ? body.notifications : true
            },
            termsAccepted: body.terms,
            registeredAt: new Date().toISOString(),
            accountStatus: 'active',
            nextSteps: [
              'Verify your email address',
              'Complete your profile',
              'Explore the dashboard'
            ]
          };
          break;

        case 'wizard-with-code-editor':
          mockResponse = {
            success: true,
            message: `Template "${body.templateName}" created successfully!`,
            templateId: randomUUID(),
            template: {
              name: body.templateName,
              type: body.templateType,
              content: body.content,
              variables: body.variables
            },
            analysis: {
              contentLineCount: body.content?.split('\n').length || 0,
              contentVariables: (body.content?.match(/\{\{.*?\}\}/g) || []).map(
                (v: string) => v.replace(/\{\{|\}\}/g, '').trim()
              ),
              definedVariables: body.variables ? Object.keys(JSON.parse(body.variables)) : [],
              allVariablesDefined: true // Simplified for mock
            },
            createdAt: new Date().toISOString(),
            preview: {
              html: body.content?.replace(/\{\{(\w+)\}\}/g, (match: string, varName: string) => {
                try {
                  const vars = JSON.parse(body.variables);
                  return vars[ varName ] !== undefined ? `[${varName}: ${vars[ varName ]}]` : match;
                } catch {
                  return match;
                }
              })
            }
          };
          break;

        case 'wizard-in-drawer':
          mockResponse = {
            success: true,
            message: 'Wizard in drawer completed successfully!',
            dataId: randomUUID(),
            field1: body.field1,
            field2: body.field2,
            completedAt: new Date().toISOString(),
            metadata: {
              completedInDrawer: true,
              stepCount: 2,
              dataSize: (body.field1?.length || 0) + (body.field2?.length || 0)
            }
          };
          break;

        default:
          mockResponse = {
            success: false,
            message: 'Unknown test type',
            testType
          };
          break;
      }

      console.log('[MOCK] Returning mock response:', mockResponse);

      // Throw a custom error that axios-mock-adapter will catch
      const mockError: any = new Error('MOCK_RESPONSE');
      mockError.config = config;
      mockError.response = {
        data: mockResponse,
        status: mockResponse.success ? 200 : 400,
        statusText: mockResponse.success ? 'OK' : 'Bad Request',
        headers: { 'content-type': 'application/json' },
        config
      } as AxiosResponse;

      return Promise.reject(mockError);
    },
    (error) => Promise.reject(error)
  );

  // Intercept response to handle our mock responses
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      // Check if this is our mock response
      if (error.message === 'MOCK_RESPONSE' && error.response) {
        console.log('[MOCK] Response interceptor caught mock response, resolving...');
        return Promise.resolve(error.response);
      }
      return Promise.reject(error);
    }
  );

  console.log('[MOCK] New Features Test mocks initialized');
}
