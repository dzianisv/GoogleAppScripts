/**
 * Mock implementations for Google Apps Script APIs
 */

// Mock cache storage
const mockCacheStorage = {};

// Mock CacheService
global.CacheService = {
  getScriptCache: () => ({
    get: (key) => mockCacheStorage[key] || null,
    put: (key, value, ttl) => {
      mockCacheStorage[key] = value;
    }
  })
};

// Mock UrlFetchApp
global.UrlFetchApp = {
  fetch: jest.fn()
};

// Mock SpreadsheetApp
global.SpreadsheetApp = {
  getActiveSheet: () => ({
    getActiveCell: () => ({
      getFormula: () => '',
      getValue: () => '',
      setValue: jest.fn()
    }),
    getRange: () => ({
      getRichTextValue: () => null,
      getFormula: () => '',
      getValue: () => '',
      setValues: jest.fn()
    })
  }),
  getUi: () => ({
    createMenu: () => ({
      addItem: function() { return this; },
      addToUi: jest.fn()
    })
  })
};

// Helper to clear mock cache between tests
global.clearMockCache = () => {
  Object.keys(mockCacheStorage).forEach(key => delete mockCacheStorage[key]);
};

// Helper to set mock cache
global.setMockCache = (key, value) => {
  mockCacheStorage[key] = value;
};

// Mock console for Google Apps Script Logger compatibility
global.Logger = {
  log: console.log
};

module.exports = {
  mockCacheStorage,
  clearMockCache: global.clearMockCache,
  setMockCache: global.setMockCache
};
