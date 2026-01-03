/**
 * Unit tests for defi_apy.gs
 */

// Load mocks before loading the module
require('./mocks/gas-mocks');

// Load the Google Apps Script file
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Read and execute the GAS file in a context with our mocks
const gasCode = fs.readFileSync(
  path.join(__dirname, '../GoogleScript/defi_apy.gs'),
  'utf8'
);

// Create a context with all globals
const context = vm.createContext({
  ...global,
  console,
  JSON,
  Date,
  Math,
  parseInt,
  parseFloat,
  Object,
  Array,
  String,
  RegExp,
  Error
});

// Execute the GAS code to define all functions
vm.runInContext(gasCode, context);

// Extract functions from context
const {
  getAverageApy,
  extractUrl_,
  getMorphoApyDecimal_,
  getMapleApyDecimal_,
  getBeefyAverageApy_,
  getDefillamaAverageApy_,
  getPaletteApy_,
  MORPHO_APY,
  MAPLE_APY,
  quoteCoinmarketcap
} = context;

describe('extractUrl_', () => {
  test('extracts URL from plain string', () => {
    const url = 'https://app.morpho.org/base/vault/0x123';
    expect(extractUrl_(url)).toBe(url);
  });

  test('extracts URL from HYPERLINK formula', () => {
    const formula = '=HYPERLINK("https://app.morpho.org/vault/0x123", "Morpho Vault")';
    expect(extractUrl_(formula)).toBe('https://app.morpho.org/vault/0x123');
  });

  test('extracts URL from string containing URL', () => {
    const text = 'Check out https://app.beefy.com/vault/test for more info';
    expect(extractUrl_(text)).toBe('https://app.beefy.com/vault/test');
  });

  test('returns input for non-URL string', () => {
    const text = 'just some text';
    expect(extractUrl_(text)).toBe('just some text');
  });
});

describe('getAverageApy URL routing', () => {
  beforeEach(() => {
    global.clearMockCache();
    global.UrlFetchApp.fetch.mockReset();
  });

  test('routes Maple Finance URLs correctly', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          syrupGlobals: {
            apy: '6300000000000000000000000000000',
            dripsYieldBoost: '50'
          }
        }
      })
    });

    const result = getAverageApy('https://app.maple.finance/earn');
    expect(typeof result).toBe('number');
  });

  test('routes Syrup.fi URLs correctly', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          syrupGlobals: {
            apy: '6300000000000000000000000000000',
            dripsYieldBoost: '50'
          }
        }
      })
    });

    const result = getAverageApy('https://syrup.fi/earn');
    expect(typeof result).toBe('number');
  });

  test('routes Morpho Ethereum URLs correctly', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          vaultByAddress: {
            state: { netApy: 0.0513 }
          }
        }
      })
    });

    const result = getAverageApy('https://app.morpho.org/vault/0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB');
    expect(result).toBeCloseTo(0.0513, 4);
  });

  test('routes Morpho Base URLs correctly', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          vaultByAddress: {
            state: { netApy: 0.0725 }
          }
        }
      })
    });

    const result = getAverageApy('https://app.morpho.org/base/vault/0xB7890CEE6CF4792cdCC13489D36D9d42726ab863/universal-usdc');
    expect(result).toBeCloseTo(0.0725, 4);
  });

  test('routes Beefy URLs correctly', () => {
    const now = Date.now();
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify([
        { t: Math.floor(now / 1000) - 86400, v: 0.05 },
        { t: Math.floor(now / 1000) - 172800, v: 0.06 }
      ])
    });

    const result = getAverageApy('https://app.beefy.com/vault/compound-base-usdc', 30);
    expect(typeof result).toBe('number');
  });

  test('routes DeFi Llama URLs correctly', () => {
    const now = new Date().toISOString();
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        status: 'success',
        data: [
          { timestamp: now, apy: 5.5 }
        ]
      })
    });

    const result = getAverageApy('https://defillama.com/yields/pool/e2f0e83e-e07b-44bd-9718-e25b96295468', 30);
    expect(typeof result).toBe('number');
  });

  test('routes Palette Finance URLs correctly', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        items: [{ info: { apr: 7.91 } }]
      })
    });

    const result = getAverageApy('https://yield.palette.finance/pools/EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r');
    expect(result).toBeCloseTo(0.0791, 4);
  });

  test('routes DeDust URLs correctly', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        items: [{ info: { apr: 7.91 } }]
      })
    });

    const result = getAverageApy('https://app.dedust.io/pools/EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r');
    expect(result).toBeCloseTo(0.0791, 4);
  });

  test('returns error for unsupported URLs', () => {
    const result = getAverageApy('https://unknown-defi.com/vault/123');
    expect(result).toContain('Error: Unsupported URL');
  });
});

describe('getMorphoApyDecimal_ chain detection', () => {
  beforeEach(() => {
    global.clearMockCache();
    global.UrlFetchApp.fetch.mockReset();
  });

  test('uses chainId 1 for Ethereum mainnet URLs', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          vaultByAddress: {
            state: { netApy: 0.05 }
          }
        }
      })
    });

    getMorphoApyDecimal_('https://app.morpho.org/vault/0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB');

    const call = global.UrlFetchApp.fetch.mock.calls[0];
    const payload = JSON.parse(call[1].payload);
    expect(payload.query).toContain('chainId: 1');
  });

  test('uses chainId 8453 for Base chain URLs', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          vaultByAddress: {
            state: { netApy: 0.07 }
          }
        }
      })
    });

    getMorphoApyDecimal_('https://app.morpho.org/base/vault/0xB7890CEE6CF4792cdCC13489D36D9d42726ab863/universal-usdc');

    const call = global.UrlFetchApp.fetch.mock.calls[0];
    const payload = JSON.parse(call[1].payload);
    expect(payload.query).toContain('chainId: 8453');
  });

  test('uses chainId 42161 for Arbitrum chain URLs', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          vaultByAddress: {
            state: { netApy: 0.06 }
          }
        }
      })
    });

    getMorphoApyDecimal_('https://app.morpho.org/arbitrum/vault/0x123456');

    const call = global.UrlFetchApp.fetch.mock.calls[0];
    const payload = JSON.parse(call[1].payload);
    expect(payload.query).toContain('chainId: 42161');
  });

  test('uses chainId 10 for Optimism chain URLs', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          vaultByAddress: {
            state: { netApy: 0.04 }
          }
        }
      })
    });

    getMorphoApyDecimal_('https://app.morpho.org/optimism/vault/0x789abc');

    const call = global.UrlFetchApp.fetch.mock.calls[0];
    const payload = JSON.parse(call[1].payload);
    expect(payload.query).toContain('chainId: 10');
  });

  test('extracts vault address correctly from URL with trailing path', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          vaultByAddress: {
            state: { netApy: 0.07 }
          }
        }
      })
    });

    getMorphoApyDecimal_('https://app.morpho.org/base/vault/0xB7890CEE6CF4792cdCC13489D36D9d42726ab863/universal-usdc');

    const call = global.UrlFetchApp.fetch.mock.calls[0];
    const payload = JSON.parse(call[1].payload);
    expect(payload.query).toContain('0xB7890CEE6CF4792cdCC13489D36D9d42726ab863');
  });

  test('returns error message when vault not found', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          vaultByAddress: null
        }
      })
    });

    const result = getMorphoApyDecimal_('https://app.morpho.org/base/vault/0xINVALID');
    expect(result).toContain('Error');
  });
});

describe('getBeefyAverageApy_', () => {
  beforeEach(() => {
    global.clearMockCache();
    global.UrlFetchApp.fetch.mockReset();
  });

  test('extracts vault ID from URL', () => {
    const now = Date.now();
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify([
        { t: Math.floor(now / 1000) - 86400, v: 0.05 }
      ])
    });

    getBeefyAverageApy_('https://app.beefy.com/vault/compound-base-usdc', 30);

    const call = global.UrlFetchApp.fetch.mock.calls[0];
    expect(call[0]).toContain('vault=compound-base-usdc');
  });

  test('returns error for invalid URL without vault ID', () => {
    const result = getBeefyAverageApy_('https://app.beefy.com/', 30);
    expect(result).toContain('Invalid URL');
  });

  test('calculates average APY correctly', () => {
    const now = Date.now();
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify([
        { t: Math.floor(now / 1000) - 86400, v: 0.04 },
        { t: Math.floor(now / 1000) - 172800, v: 0.06 },
        { t: Math.floor(now / 1000) - 259200, v: 0.05 }
      ])
    });

    const result = getBeefyAverageApy_('https://app.beefy.com/vault/test-vault', 30);
    expect(result).toBeCloseTo(0.05, 4);
  });
});

describe('getDefillamaAverageApy_', () => {
  beforeEach(() => {
    global.clearMockCache();
    global.UrlFetchApp.fetch.mockReset();
  });

  test('extracts pool ID from URL', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        status: 'success',
        data: [{ timestamp: new Date().toISOString(), apy: 5 }]
      })
    });

    getDefillamaAverageApy_('https://defillama.com/yields/pool/e2f0e83e-e07b-44bd-9718-e25b96295468', 30);

    const call = global.UrlFetchApp.fetch.mock.calls[0];
    expect(call[0]).toContain('e2f0e83e-e07b-44bd-9718-e25b96295468');
  });

  test('returns error for invalid URL without pool ID', () => {
    const result = getDefillamaAverageApy_('https://defillama.com/yields', 30);
    expect(result).toContain('Invalid URL');
  });

  test('converts APY from percentage to decimal', () => {
    const now = new Date().toISOString();
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        status: 'success',
        data: [{ timestamp: now, apy: 5.5 }]
      })
    });

    // DeFi Llama pool IDs are UUIDs like: e2f0e83e-e07b-44bd-9718-e25b96295468
    const result = getDefillamaAverageApy_('https://defillama.com/yields/pool/a1b2c3d4-e5f6-7890-abcd-ef1234567890', 30);
    expect(result).toBeCloseTo(0.055, 4);
  });
});

describe('getPaletteApy_', () => {
  beforeEach(() => {
    global.clearMockCache();
    global.UrlFetchApp.fetch.mockReset();
  });

  test('extracts pool address from Palette URL', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        items: [{ info: { apr: 7.91 } }]
      })
    });

    getPaletteApy_('https://yield.palette.finance/pools/EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r');

    const call = global.UrlFetchApp.fetch.mock.calls[0];
    expect(call[0]).toContain('EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r');
  });

  test('extracts pool address from DeDust URL', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        items: [{ info: { apr: 7.91 } }]
      })
    });

    getPaletteApy_('https://app.dedust.io/pools/EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r');

    const call = global.UrlFetchApp.fetch.mock.calls[0];
    expect(call[0]).toContain('EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r');
  });

  test('returns error for URL without pool address', () => {
    const result = getPaletteApy_('https://yield.palette.finance/');
    expect(result).toContain('Invalid URL');
  });

  test('converts APR from percentage to decimal', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        items: [{ info: { apr: 10.5 } }]
      })
    });

    const result = getPaletteApy_('https://yield.palette.finance/pools/test-pool');
    expect(result).toBeCloseTo(0.105, 4);
  });
});

describe('Caching behavior', () => {
  beforeEach(() => {
    global.clearMockCache();
    global.UrlFetchApp.fetch.mockReset();
  });

  test('uses cached value when available', () => {
    global.setMockCache('morphoApyDecimal_8453_0xB7890CEE6CF4792cdCC13489D36D9d42726ab863', JSON.stringify({ apy: 0.08 }));

    const result = getMorphoApyDecimal_('https://app.morpho.org/base/vault/0xB7890CEE6CF4792cdCC13489D36D9d42726ab863');
    
    expect(result).toBe(0.08);
    expect(global.UrlFetchApp.fetch).not.toHaveBeenCalled();
  });

  test('fetches fresh data when cache is empty', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => JSON.stringify({
        data: {
          vaultByAddress: {
            state: { netApy: 0.065 }
          }
        }
      })
    });

    const result = getMorphoApyDecimal_('https://app.morpho.org/base/vault/0xNEWVAULT');
    
    expect(result).toBe(0.065);
    expect(global.UrlFetchApp.fetch).toHaveBeenCalled();
  });
});

describe('Error handling', () => {
  beforeEach(() => {
    global.clearMockCache();
    global.UrlFetchApp.fetch.mockReset();
  });

  test('handles API errors gracefully', () => {
    global.UrlFetchApp.fetch.mockImplementation(() => {
      throw new Error('Network error');
    });

    const result = getMorphoApyDecimal_('https://app.morpho.org/vault/0x123');
    expect(result).toContain('Error');
  });

  test('handles malformed JSON response', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => 'not valid json'
    });

    const result = getMorphoApyDecimal_('https://app.morpho.org/vault/0x123');
    expect(result).toContain('Error');
  });

  test('getAverageApy returns error for non-string input', () => {
    const result = getAverageApy(12345);
    expect(result).toContain('Error');
  });
});
