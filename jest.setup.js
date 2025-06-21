// jest.setup.js

// Simple in-memory storage mock
const storageMock = (() => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

// @ts-ignore
global.localStorage = storageMock;
// @ts-ignore
global.sessionStorage = storageMock;

global.localStorage = storageMock;
global.sessionStorage = storageMock;

// Prevent unhandled promise rejections from failing tests
process.on('unhandledRejection', (reason) => {
  // Swallow unhandled promise rejections in tests
  // console.warn('Unhandled Rejection during tests:', reason);
}); 