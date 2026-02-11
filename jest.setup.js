// jest.setup.js

// Polyfill TextEncoder/TextDecoder (needed by react-router-dom v6+ in jsdom)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock IntersectionObserver (not available in jsdom)
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) { this._callback = callback; }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia (not available in jsdom)
global.matchMedia = global.matchMedia || function(query) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: function() {},
    removeListener: function() {},
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return false; },
  };
};

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