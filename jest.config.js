module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup-after-env.js'],
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    // Transform ESM-only node_modules so Jest can parse them
    '^.+\\.jsx?$': 'ts-jest',
  },
  transformIgnorePatterns: [
    // Transform ESM modules that Jest can't parse natively
    '/node_modules/(?!(react-error-boundary|@ant-design|jsonpath-plus|@blocknote|prosemirror-.*|orderedmap)/)',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/jest.css-mock.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/helpers/',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};