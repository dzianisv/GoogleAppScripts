/**
 * Google Apps Script for DeFi and Crypto data
 * 
 * DeFi APY Sources:
 * - Maple Finance (https://app.maple.finance/earn)
 * - Morpho (https://app.morpho.org)
 * - Beefy Finance (https://app.beefy.com)
 * - DeFi Llama (https://defillama.com)
 * - Palette Finance / TON (https://yield.palette.finance)
 * 
 * Crypto Prices:
 * - CoinMarketCap
 */

// ============= MAIN FUNCTIONS =============

/**
 * Calculates the average APY based on a given URL and optional number of days.
 * Supports: Maple Finance, Morpho, Beefy Finance, DeFi Llama
 * 
 * Can accept:
 * - A direct URL string
 * - A cell reference containing a hyperlink (extracts the URL automatically)
 * - A cell with a HYPERLINK formula
 *
 * @param {string|Range} urlOrCell - The URL string or cell reference containing a hyperlink.
 * @param {number} [days=30] - The number of days to calculate the APY over (default: 30, used for Beefy/DeFiLlama).
 * @return {number|string} The calculated APY as a decimal (e.g., 0.063 for 6.3%) or an error message.
 * @customfunction
 */
function getAverageApy(urlOrCell, days) {
  days = days || 30;
  
  // Extract URL from input (handles hyperlinks, formulas, or plain text)
  const url = extractUrl_(urlOrCell);
  
  // Ensure the input is valid (url must be a string)
  if (typeof url !== "string" || !url) {
    return "Error: Could not extract a valid URL.";
  }
  
  // Check if the URL starts with the expected prefix
  if (url.indexOf("https://app.maple.finance") === 0 || url.indexOf("https://syrup.fi") === 0) {
    return getMapleApyDecimal_();
  } else if (url.indexOf("https://app.morpho.org") === 0) {
    return getMorphoApyDecimal_(url);
  } else if (url.indexOf("https://app.beefy.com") === 0) {
    return getBeefyAverageApy_(url, days);
  } else if (url.indexOf("https://defillama.com") === 0) {
    return getDefillamaAverageApy_(url, days);
  } else if (url.indexOf("https://yield.palette.finance") === 0 || url.indexOf("https://app.dedust.io") === 0) {
    return getPaletteApy_(url);
  } else {
    return "Error: Unsupported URL. Supported: app.maple.finance, syrup.fi, app.morpho.org, app.beefy.com, defillama.com, yield.palette.finance, app.dedust.io";
  }
}

/**
 * Function to get the price of a cryptocurrency from CoinMarketCap.
 * @param {string} name - The cryptocurrency name or symbol (e.g., "bitcoin", "ETH", "SOL").
 * @return {string} - The price of the cryptocurrency as a string, or "N/A" if not found.
 * @customfunction
 */
function quoteCoinmarketcap(name) {
  const cache = CacheService.getScriptCache();
  const name1 = name.split(' ')[0];

  const symbolMap = {
    "TON": "toncoin",
    "ASTER": "aster",
    "ETH": "ethereum",
    "PUMP": "pump-fun",
    "HYPE": "hyperliquid",
    "JUP": "jupiter-ag",
    "BTC": "bitcoin",
    "SOL": "solana",
    "STRK": "starknet-token",
    "TRUMP": "official-trump", 
    "MATIC": "polygon-ecosystem-token",
    "POL": "polygon-ecosystem-token",
    "LINEA": "linea",
  };
  const symbol = symbolMap[name1] || name1.toLowerCase();

  const cacheKey = "coinmarketcap_" + symbol;
  const cachedPrice = cache.get(cacheKey);

  if (cachedPrice) {
    return cachedPrice;
  }

  const url = "https://coinmarketcap.com/currencies/" + symbol;

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const html = response.getContentText();

    const priceRegex = /<span[^>]*data-test="text-cdp-price-display"[^>]*>([^<]+)<\/span>/;
    const match = html.match(priceRegex);

    if (match && match[1]) {
      const price = match[1].trim();
      cache.put(cacheKey, price, 21600); // Cache for 6 hours
      return price;
    } else {
      return "N/A";
    }
  } catch (error) {
    return "Error: " + error.message;
  }
}


// ============= MAPLE FINANCE =============

/**
 * Fetches the current APY from Maple Finance
 * @returns {number} The APY as a percentage (e.g., 6.3 for 6.3%)
 * @customfunction
 */
function MAPLE_APY() {
  const url = 'https://api.maple.finance/v2/graphql';
  
  const payload = {
    operationName: 'getLendData',
    variables: {
      excludePools: [
        '0xb1206b74f612f478c12a647d12e7e822af5d8244',
        '0x7afa9cea7a060a84401c7209c02af989b391cc87'
      ]
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: '7c036874288379783f32f11f7f4ca47077d5726cde545ccd433894c7698042f9'
      }
    }
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apollographql-client-name': 'Syrup',
      'apollographql-client-version': 'prod-mainnet-v2.5.9'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    const baseApy = parseInt(data.data.syrupGlobals.apy) / 1e28;
    const dripsBoost = parseInt(data.data.syrupGlobals.dripsYieldBoost) / 10000;
    const totalApy = baseApy + dripsBoost;
    
    return Math.round(totalApy * 100) / 100;
  } catch (error) {
    return 'Error: ' + error.message;
  }
}

/**
 * Fetches detailed Maple Finance data including pool-specific APYs
 * @returns {Array} 2D array with pool data
 * @customfunction
 */
function MAPLE_DETAILS() {
  const url = 'https://api.maple.finance/v2/graphql';
  
  const payload = {
    operationName: 'getLendData',
    variables: {
      excludePools: [
        '0xb1206b74f612f478c12a647d12e7e822af5d8244',
        '0x7afa9cea7a060a84401c7209c02af989b391cc87'
      ]
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: '7c036874288379783f32f11f7f4ca47077d5726cde545ccd433894c7698042f9'
      }
    }
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apollographql-client-name': 'Syrup',
      'apollographql-client-version': 'prod-mainnet-v2.5.9'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    const baseApy = parseInt(data.data.syrupGlobals.apy) / 1e28;
    const dripsBoost = parseInt(data.data.syrupGlobals.dripsYieldBoost) / 10000;
    const totalApy = baseApy + dripsBoost;
    
    const results = [
      ['Metric', 'Value'],
      ['Total APY', totalApy.toFixed(2) + '%'],
      ['Base APY', baseApy.toFixed(2) + '%'],
      ['Drips Boost', '+' + dripsBoost.toFixed(2) + '%']
    ];
    
    const pools = data.data.syrupPoolsUSD || [];
    let totalTvl = 0;
    
    pools.forEach(pool => {
      const symbol = pool.asset.symbol;
      const tvl = parseInt(pool.tvl) / 1e6;
      const poolApy = parseInt(pool.weeklyApy) / 1e28;
      totalTvl += tvl;
      
      results.push([symbol + ' APY', poolApy.toFixed(2) + '%']);
      results.push([symbol + ' TVL', '$' + (tvl / 1e9).toFixed(2) + 'B']);
    });
    
    results.push(['Total AUM', '$' + (totalTvl / 1e9).toFixed(2) + 'B']);
    
    return results;
  } catch (error) {
    return [['Error', error.message]];
  }
}


// ============= MORPHO =============

/**
 * Fetches the current APY from Morpho Steakhouse USDC vault
 * @param {string} vaultAddress - Optional vault address (defaults to Steakhouse USDC)
 * @returns {number} The APY as a percentage (e.g., 5.13 for 5.13%)
 * @customfunction
 */
function MORPHO_APY(vaultAddress) {
  vaultAddress = vaultAddress || '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB';
  
  const url = 'https://blue-api.morpho.org/graphql';
  
  const query = '{ vaultByAddress(address: "' + vaultAddress + '", chainId: 1) { state { netApy } } }';
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    const netApy = data.data.vaultByAddress.state.netApy;
    
    return Math.round(netApy * 10000) / 100;
  } catch (error) {
    return 'Error: ' + error.message;
  }
}

/**
 * Fetches detailed Morpho vault data
 * @param {string} vaultAddress - Optional vault address (defaults to Steakhouse USDC)
 * @returns {Array} 2D array with vault data
 * @customfunction
 */
function MORPHO_DETAILS(vaultAddress) {
  vaultAddress = vaultAddress || '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB';
  
  const url = 'https://blue-api.morpho.org/graphql';
  
  const query = '{ vaultByAddress(address: "' + vaultAddress + '", chainId: 1) { name symbol state { apy netApy netApyWithoutRewards totalAssetsUsd fee } } }';
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    const vault = data.data.vaultByAddress;
    const state = vault.state;
    
    return [
      ['Metric', 'Value'],
      ['Vault Name', vault.name],
      ['Symbol', vault.symbol],
      ['Net APY', (state.netApy * 100).toFixed(2) + '%'],
      ['Native APY', (state.apy * 100).toFixed(2) + '%'],
      ['APY Without Rewards', (state.netApyWithoutRewards * 100).toFixed(2) + '%'],
      ['Total Deposits', '$' + (state.totalAssetsUsd / 1e6).toFixed(2) + 'M'],
      ['Fee', (state.fee * 100).toFixed(2) + '%']
    ];
  } catch (error) {
    return [['Error', error.message]];
  }
}


// ============= COMBINED VIEW =============

/**
 * Fetches APY from both Maple Finance and Morpho
 * @returns {Array} 2D array with both APYs
 * @customfunction
 */
function DEFI_APYS() {
  const mapleApy = MAPLE_APY();
  const morphoApy = MORPHO_APY();
  
  return [
    ['Protocol', 'APY'],
    ['Maple Finance', typeof mapleApy === 'number' ? mapleApy + '%' : mapleApy],
    ['Morpho (Steakhouse USDC)', typeof morphoApy === 'number' ? morphoApy + '%' : morphoApy]
  ];
}


// ============= PALETTE FINANCE (TON) =============

/**
 * Returns the APR (Annual Percentage Rate) for a given TON pool address from Palette Finance
 * @param {string} poolAddress The pool address to look up (TON address format)
 * @return {number} The APR value as a decimal (e.g., 0.0791 for 7.91%)
 * @customfunction
 */
function PALETTE_APY(poolAddress) {
  const url = "https://yield.palette.finance/api/v1/pools/?address=" + poolAddress;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    
    if (data.items && data.items.length > 0 && data.items[0].info && data.items[0].info.apr !== undefined) {
      return data.items[0].info.apr / 100;
    } else {
      return "Error: No APR data found for the given pool address";
    }
  } catch (error) {
    return "Error: " + error.message;
  }
}


// ============= INTERNAL HELPERS =============

/**
 * Extracts a URL from various input types:
 * - Plain URL string
 * - Cell with rich text hyperlink
 * - Cell with HYPERLINK formula
 * - Text containing a URL
 * 
 * @param {string|Range} input - The input to extract URL from
 * @returns {string|null} The extracted URL or null
 * @private
 */
function extractUrl_(input) {
  if (typeof input === "string") {
    // Check if it's a HYPERLINK formula
    const hyperlinkMatch = input.match(/^=HYPERLINK\s*\(\s*"([^"]+)"/i);
    if (hyperlinkMatch) {
      return hyperlinkMatch[1];
    }
    
    // Check if the string contains a URL
    const urlMatch = input.match(/https?:\/\/[^\s"',)]+/);
    if (urlMatch) {
      return urlMatch[0];
    }
    
    if (input.indexOf("http") === 0) {
      return input;
    }
    
    return input;
  }
  
  // Try to get hyperlink from cell reference
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const activeCell = sheet.getActiveCell();
    
    const formula = activeCell.getFormula();
    if (formula) {
      const cellRefMatch = formula.match(/getAverageApy\s*\(\s*([A-Z]+[0-9]+)/i);
      if (cellRefMatch) {
        const refCell = sheet.getRange(cellRefMatch[1]);
        
        // Try rich text link
        const richText = refCell.getRichTextValue();
        if (richText) {
          const linkUrl = richText.getLinkUrl();
          if (linkUrl) {
            return linkUrl;
          }
          
          const runs = richText.getRuns();
          for (let i = 0; i < runs.length; i++) {
            const runUrl = runs[i].getLinkUrl();
            if (runUrl) {
              return runUrl;
            }
          }
        }
        
        // Try HYPERLINK formula
        const refFormula = refCell.getFormula();
        if (refFormula) {
          const hyperlinkMatch = refFormula.match(/=HYPERLINK\s*\(\s*"([^"]+)"/i);
          if (hyperlinkMatch) {
            return hyperlinkMatch[1];
          }
        }
        
        return refCell.getValue();
      }
    }
  } catch (e) {
    // Continue with input if SpreadsheetApp not available
  }
  
  return input;
}

/**
 * Internal: Fetches Maple APY as a decimal with caching
 * @returns {number} The APY as a decimal (e.g., 0.063 for 6.3%)
 * @private
 */
function getMapleApyDecimal_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = "mapleApyDecimal";
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return JSON.parse(cachedData).apy;
  }

  const url = 'https://api.maple.finance/v2/graphql';
  
  const payload = {
    operationName: 'getLendData',
    variables: {
      excludePools: [
        '0xb1206b74f612f478c12a647d12e7e822af5d8244',
        '0x7afa9cea7a060a84401c7209c02af989b391cc87'
      ]
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: '7c036874288379783f32f11f7f4ca47077d5726cde545ccd433894c7698042f9'
      }
    }
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apollographql-client-name': 'Syrup',
      'apollographql-client-version': 'prod-mainnet-v2.5.9'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    const baseApy = parseInt(data.data.syrupGlobals.apy) / 1e28;
    const dripsBoost = parseInt(data.data.syrupGlobals.dripsYieldBoost) / 10000;
    const totalApy = (baseApy + dripsBoost) / 100;
    
    cache.put(cacheKey, JSON.stringify({ apy: totalApy }), 21600);
    
    return totalApy;
  } catch (error) {
    return 'Error: ' + error.message;
  }
}

/**
 * Internal: Fetches Morpho APY as a decimal with caching
 * @param {string} url - The Morpho vault URL
 * @returns {number} The APY as a decimal (e.g., 0.0513 for 5.13%)
 * @private
 */
function getMorphoApyDecimal_(url) {
  let vaultAddress = '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB';
  const vaultMatch = url.match(/vault\/([^/?]+)/);
  if (vaultMatch) {
    vaultAddress = vaultMatch[1];
  }
  
  const cache = CacheService.getScriptCache();
  const cacheKey = "morphoApyDecimal_" + vaultAddress;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return JSON.parse(cachedData).apy;
  }

  const apiUrl = 'https://blue-api.morpho.org/graphql';
  const query = '{ vaultByAddress(address: "' + vaultAddress + '", chainId: 1) { state { netApy } } }';
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const data = JSON.parse(response.getContentText());
    
    const netApy = data.data.vaultByAddress.state.netApy;
    
    cache.put(cacheKey, JSON.stringify({ apy: netApy }), 21600);
    
    return netApy;
  } catch (error) {
    return 'Error: ' + error.message;
  }
}

/**
 * Internal: Fetches Beefy average APY with caching
 * @param {string} url - The Beefy vault URL
 * @param {number} days - Number of days to average
 * @returns {number} The APY as a decimal
 * @private
 */
function getBeefyAverageApy_(url, days) {
  const cache = CacheService.getScriptCache();

  const vaultMatch = url.match(/vault\/([^/]+)/);
  if (!vaultMatch) {
    return "Invalid URL: Vault ID not found.";
  }
  const vault = vaultMatch[1];

  const cacheKey = "beefyApy_" + vault + "_" + days;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return JSON.parse(cachedData).averageAPY;
  }

  try {
    const response = UrlFetchApp.fetch("https://data.beefy.finance/api/v2/apys?vault=" + vault + "&bucket=1d_1Y");
    const data = JSON.parse(response.getContentText());

    const recentData = data.filter(function(item) {
      const timestamp = item.t * 1000;
      return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
    });

    if (recentData.length === 0) {
      return "No recent data available for this vault.";
    }

    const averageAPY = recentData.reduce(function(sum, item) {
      return sum + item.v;
    }, 0) / recentData.length;

    cache.put(cacheKey, JSON.stringify({ averageAPY: averageAPY }), 21600);

    return averageAPY;
  } catch (error) {
    return "Failed to fetch APY data: " + error.message;
  }
}

/**
 * Internal: Fetches DeFi Llama average APY with caching
 * @param {string} url - The DeFi Llama pool URL
 * @param {number} days - Number of days to average
 * @returns {number} The APY as a decimal
 * @private
 */
function getDefillamaAverageApy_(url, days) {
  const cache = CacheService.getScriptCache();

  const poolIdMatch = url.match(/pool\/([a-f0-9-]+)/);
  if (!poolIdMatch) {
    return "Invalid URL: Pool ID not found.";
  }
  const poolId = poolIdMatch[1];

  const cacheKey = "defillamaApy_" + poolId + "_" + days;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return JSON.parse(cachedData).averageAPY;
  }

  try {
    const response = UrlFetchApp.fetch("https://yields.llama.fi/chart/" + poolId);
    const jsonResponse = JSON.parse(response.getContentText());

    if (jsonResponse.status !== "success") {
      return "Failed to fetch data: " + jsonResponse.status;
    }

    const now = new Date();
    const daysInMilliseconds = days * 24 * 60 * 60 * 1000;
    const recentData = jsonResponse.data.filter(function(item) {
      const timestamp = new Date(item.timestamp).getTime();
      return now.getTime() - timestamp <= daysInMilliseconds;
    });

    if (recentData.length === 0) {
      return "No recent data available for this pool.";
    }

    const averageAPY = recentData.reduce(function(sum, item) {
      return sum + item.apy;
    }, 0) / recentData.length;

    cache.put(cacheKey, JSON.stringify({ averageAPY: averageAPY / 100 }), 21600);

    return averageAPY / 100;
  } catch (error) {
    return "Failed to fetch APY data: " + error.message;
  }
}

/**
 * Internal: Fetches Palette Finance (TON) APY with caching
 * @param {string} url - The Palette Finance or DeDust URL
 * @returns {number} The APY as a decimal
 * @private
 */
function getPaletteApy_(url) {
  // Extract pool address from URL
  // Palette: https://yield.palette.finance/pools/EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r
  // DeDust: https://app.dedust.io/pools/EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r
  const poolMatch = url.match(/pools\/([A-Za-z0-9_-]+)/);
  if (!poolMatch) {
    return "Invalid URL: Pool address not found.";
  }
  const poolAddress = poolMatch[1];

  const cache = CacheService.getScriptCache();
  const cacheKey = "paletteApy_" + poolAddress;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return JSON.parse(cachedData).apy;
  }

  try {
    const apiUrl = "https://yield.palette.finance/api/v1/pools/?address=" + poolAddress;
    const response = UrlFetchApp.fetch(apiUrl);
    const data = JSON.parse(response.getContentText());

    if (data.items && data.items.length > 0 && data.items[0].info && data.items[0].info.apr !== undefined) {
      const apy = data.items[0].info.apr / 100;
      cache.put(cacheKey, JSON.stringify({ apy: apy }), 21600);
      return apy;
    } else {
      return "Error: No APR data found for the given pool address";
    }
  } catch (error) {
    return "Error: " + error.message;
  }
}


// ============= MENU =============

/**
 * Creates a custom menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('DeFi & Crypto')
    .addItem('Refresh Maple APY', 'insertMapleApy')
    .addItem('Refresh Morpho APY', 'insertMorphoApy')
    .addItem('Refresh All APYs', 'insertAllApys')
    .addToUi();
}

/**
 * Inserts Maple APY into the active cell
 */
function insertMapleApy() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const cell = sheet.getActiveCell();
  cell.setValue(MAPLE_APY());
}

/**
 * Inserts Morpho APY into the active cell
 */
function insertMorphoApy() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const cell = sheet.getActiveCell();
  cell.setValue(MORPHO_APY());
}

/**
 * Inserts all APYs as a table
 */
function insertAllApys() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const cell = sheet.getActiveCell();
  const data = DEFI_APYS();
  
  const range = sheet.getRange(cell.getRow(), cell.getColumn(), data.length, data[0].length);
  range.setValues(data);
}


// ============= TEST FUNCTIONS =============

/**
 * Test function for getAverageApy
 */
function testGetAverageApy() {
  console.log("Maple:", getAverageApy("https://app.maple.finance/earn"));
  console.log("Morpho:", getAverageApy("https://app.morpho.org/vault/0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB"));
  console.log("Beefy:", getAverageApy("https://app.beefy.com/vault/compound-base-usdc"));
  console.log("DeFiLlama:", getAverageApy("https://defillama.com/yields/pool/e2f0e83e-e07b-44bd-9718-e25b96295468"));
  console.log("Palette/TON:", getAverageApy("https://yield.palette.finance/pools/EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r"));
  console.log("DeDust/TON:", getAverageApy("https://app.dedust.io/pools/EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r"));
}

/**
 * Test function for quoteCoinmarketcap
 */
function testQuoteCoinmarketcap() {
  console.log("BTC:", quoteCoinmarketcap("BTC"));
  console.log("ETH:", quoteCoinmarketcap("ETH"));
  console.log("SOL:", quoteCoinmarketcap("SOL"));
}

/**
 * Test function for PALETTE_APY
 */
function testPaletteApy() {
  console.log("DeDust Pool:", PALETTE_APY("EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r"));
}
