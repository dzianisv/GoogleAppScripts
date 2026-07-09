/**
 * Google Apps Script for DeFi and Crypto data
 * 
 * DeFi APY Sources:
 * - Maple Finance (https://app.maple.finance/earn)
 * - Morpho (https://app.morpho.org)
 * - Beefy Finance (https://app.beefy.com)
 * - DeFi Llama (https://defillama.com) - with pool search by name
 * - Palette Finance / TON (https://yield.palette.finance)
 * - Pendle Finance (https://app.pendle.finance)
 * 
 * Pool Search Functions:
 * - getAverageApyByName("storm usdt") - Search DeFi Llama pools by name and get average APY
 * - getCurrentApyByName("ethena susde") - Get current (spot) APY by name
 * - DEFILLAMA_SEARCH("woofi") - Search and list matching pools
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
    return "Error: Could not extract URL. For cells with hyperlinks (clickable text), use =getAverageApyFromCell(\"A1\") instead.";
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
  } else if (url.indexOf("https://www.avantisfi.com") === 0 || url.indexOf("https://avantisfi.com") === 0) {
    return getAvantisApy_(url, days);
  } else if (url.indexOf("https://app.pendle.finance") === 0) {
    return getPendleApy_(url);
  } else {
    return "Error: Unsupported URL. Supported: app.maple.finance, syrup.fi, app.morpho.org, app.beefy.com, defillama.com, yield.palette.finance, app.dedust.io, avantisfi.com, app.pendle.finance";
  }
}

/**
 * Calculates the average APY by reading a hyperlink from a specified cell address.
 * Use this function when a cell contains a rich text hyperlink (clickable link with display text).
 * 
 * Example: If cell A1 contains "Universal USDC @ Morpho" with a hyperlink to the vault URL,
 * use =getAverageApyFromCell("A1") to extract the URL and get the APY.
 * 
 * For cells on a different sheet, use the sheet name: =getAverageApyFromCell("Sheet1!A1")
 * 
 * IMPORTANT: Due to Google Sheets limitations, this function may not work when called as a
 * custom function (=getAverageApyFromCell("A1")). If you get "No URL found" errors, try:
 * 1. Run testRichTextExtraction() from the script editor to debug
 * 2. Use =HYPERLINK("url", "display text") instead of Insert > Link
 * 3. Use the refreshApyFromCell() function via custom menu instead
 *
 * @param {string} cellAddress - The cell address containing the hyperlink (e.g., "A1", "B2", "Sheet1!A1").
 * @param {number} [days=30] - The number of days to calculate the APY over (default: 30, used for Beefy/DeFiLlama).
 * @return {number|string} The calculated APY as a decimal (e.g., 0.063 for 6.3%) or an error message.
 * @customfunction
 */
function getAverageApyFromCell(cellAddress, days) {
  days = days || 30;
  
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let cell;
    let targetSheet;
    
    // Check if cell address includes sheet name (e.g., "Sheet1!A1")
    if (cellAddress.indexOf('!') !== -1) {
      // Parse sheet name and cell reference
      const parts = cellAddress.split('!');
      let sheetName = parts[0];
      const cellRef = parts[1];
      
      // Remove quotes from sheet name if present (e.g., 'Sheet Name'!A1)
      sheetName = sheetName.replace(/^'|'$/g, '');
      
      targetSheet = spreadsheet.getSheetByName(sheetName);
      if (!targetSheet) {
        return "Error: Sheet '" + sheetName + "' not found.";
      }
      cell = targetSheet.getRange(cellRef);
    } else {
      // No sheet specified - try to find the cell
      // First, try the active sheet
      targetSheet = spreadsheet.getActiveSheet();
      cell = targetSheet.getRange(cellAddress);
      
      // If no value in active sheet, search all sheets
      const cellValue = cell.getValue();
      if (!cellValue && cellValue !== 0) {
        const sheets = spreadsheet.getSheets();
        for (let i = 0; i < sheets.length; i++) {
          const testCell = sheets[i].getRange(cellAddress);
          const testValue = testCell.getValue();
          if (testValue || testValue === 0) {
            cell = testCell;
            targetSheet = sheets[i];
            break;
          }
        }
      }
    }
    
    // Try to extract URL from the cell
    const url = extractUrlFromCell_(cell);
    
    if (url) {
      return getAverageApy(url, days);
    }
    
    // Provide more helpful error message
    const cellValue = cell.getValue();
    if (cellValue) {
      return "Error: Cell " + cellAddress + " contains '" + cellValue + "' but no hyperlink URL was found. " +
             "Try using =HYPERLINK(\"url\", \"" + cellValue + "\") or run testRichTextExtraction() to debug.";
    }
    
    return "Error: No URL found in cell " + cellAddress + ". Ensure the cell contains a hyperlink or URL.";
  } catch (error) {
    return "Error: " + error.message;
  }
}

/**
 * Extracts URL from a cell (rich text, HYPERLINK formula, or plain text)
 * @param {Range} cell - The cell range to extract URL from
 * @returns {string|null} The extracted URL or null
 * @private
 */
function extractUrlFromCell_(cell) {
  // First, try to get URL from rich text
  const richText = cell.getRichTextValue();
  if (richText) {
    // Try to get the link from the entire rich text
    let url = richText.getLinkUrl();
    
    // If no link on the whole text, check individual runs
    if (!url) {
      const runs = richText.getRuns();
      for (let i = 0; i < runs.length; i++) {
        const runUrl = runs[i].getLinkUrl();
        if (runUrl) {
          return runUrl;
        }
      }
    }
    
    if (url) {
      return url;
    }
  }
  
  // Try HYPERLINK formula
  const formula = cell.getFormula();
  if (formula) {
    const hyperlinkMatch = formula.match(/=HYPERLINK\s*\(\s*"([^"]+)"/i);
    if (hyperlinkMatch) {
      return hyperlinkMatch[1];
    }
  }
  
  // Fall back to cell value (might be a plain URL)
  const value = cell.getValue();
  if (value && typeof value === "string" && value.indexOf("http") === 0) {
    return value;
  }
  
  return null;
}

/**
 * Function to get the price of a cryptocurrency (via CoinGecko's public API).
 *
 * NOTE (2026-07-09): despite the name/original docstring, this has NOT called
 * CoinMarketCap for a while -- it calls CoinGecko's public `simple/price`
 * endpoint (no API key). CoinGecko's anonymous/public tier is rate-limited
 * (undocumented, informally ~5-15 req/min per IP, shared across every Google
 * Apps Script user on Google's IPs) and got stricter in 2025. When throttled
 * it returns HTTP 429 with a *plaintext* body ("Throttled"), not JSON -- the
 * old code fed that straight into JSON.parse() with no status check, which
 * threw `Unexpected token 'T', "Throttled" is not valid JSON` and surfaced
 * as literal error text, cascading into #VALUE!/$0 downstream (Crypto!F89,
 * Totals!C6/C7/C11).
 *
 * Fix: check the HTTP status before parsing, retry twice with backoff, and
 * on final failure fall back to the last confirmed-good price (persisted,
 * no expiry) instead of ever showing N/A/Error once a symbol has resolved
 * successfully at least once.
 *
 * Recommended follow-up (not applied here, opt-in via script property):
 * register a free CoinGecko "Demo" API key (no cost, no card) at
 * https://www.coingecko.com/en/developers/dashboard and set it as a script
 * property named COINGECKO_API_KEY (Project Settings > Script properties).
 * The anonymous tier used today is materially stricter than the free keyed
 * tier, which is the more durable fix for the throttling itself.
 *
 * @param {string} name - The cryptocurrency name or symbol (e.g., "bitcoin", "ETH", "SOL").
 * @return {string} - The price of the cryptocurrency as a string, or "N/A" if never resolved.
 * @customfunction
 */
function quoteCoinmarketcap(name) {
  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();
  const name1 = String(name).trim().split(' ')[0];

  const geckoMap = {
    "TON": "the-open-network", "toncoin": "the-open-network",
    "ASTER": "astar", "aster": "astar",
    "ETH": "ethereum", "ethereum": "ethereum",
    "PUMP": "pump-fun", "pump-fun": "pump-fun",
    "HYPE": "hyperliquid", "hyperliquid": "hyperliquid",
    "JUP": "jup", "jupiter-ag": "jup",
    "BTC": "bitcoin", "bitcoin": "bitcoin",
    "SOL": "solana", "solana": "solana",
    "STRK": "starknet", "starknet-token": "starknet",
    "TRUMP": "official-trump", "official-trump": "official-trump",
    "MATIC": "matic-network", "POL": "matic-network", "polygon-ecosystem-token": "matic-network",
    "LINEA": "linea", "linea": "linea",
    "PAXG": "pax-gold", "pax-gold": "pax-gold",
    "OP": "optimism", "optimism-ethereum": "optimism",
    "USDC": "usd-coin", "USDT": "tether",
  };

  const geckoId = geckoMap[name1] || name1.toLowerCase();
  const cacheKey = "coingecko_" + geckoId;
  const lastGoodKey = "coingecko_lastgood_" + geckoId;

  const cachedPrice = cache.get(cacheKey);
  if (cachedPrice !== null) return parseFloat(cachedPrice);

  // Optional: set a free CoinGecko Demo API key via Project Settings >
  // Script properties as COINGECKO_API_KEY to move off the stricter
  // anonymous tier. Safe to leave unset -- falls back to today's behavior.
  const apiKey = props.getProperty("COINGECKO_API_KEY");
  const fetchOptions = { muteHttpExceptions: true };
  if (apiKey) fetchOptions.headers = { "x-cg-demo-api-key": apiKey };

  const maxAttempts = 3; // 1 initial try + 2 retries
  const backoffMs = [500, 1500];

  function fetchJson_(url) {
    const resp = UrlFetchApp.fetch(url, fetchOptions);
    const code = resp.getResponseCode();
    if (code !== 200) return null; // e.g. 429 "Throttled" plaintext body
    try {
      return JSON.parse(resp.getContentText());
    } catch (e) {
      return null; // non-JSON body
    }
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const url = "https://api.coingecko.com/api/v3/simple/price?ids=" + encodeURIComponent(geckoId) + "&vs_currencies=usd";
      const data = fetchJson_(url);

      if (data && data[geckoId] && data[geckoId].usd !== undefined) {
        const price = data[geckoId].usd;
        cache.put(cacheKey, price.toString(), 21600); // 6h fast-path cache
        props.setProperty(lastGoodKey, JSON.stringify({ price: price, ts: Date.now() }));
        return price;
      }

      if (data) {
        // 200 OK but this id wasn't found -- try CoinGecko's search as a
        // one-time fallback (not worth retrying/backoff on its own).
        const searchUrl = "https://api.coingecko.com/api/v3/search?query=" + encodeURIComponent(name1);
        const searchData = fetchJson_(searchUrl);

        if (searchData && searchData.coins && searchData.coins.length > 0) {
          const foundId = searchData.coins[0].id;
          const priceUrl = "https://api.coingecko.com/api/v3/simple/price?ids=" + foundId + "&vs_currencies=usd";
          const priceData = fetchJson_(priceUrl);
          if (priceData && priceData[foundId] && priceData[foundId].usd !== undefined) {
            const price = priceData[foundId].usd;
            cache.put(cacheKey, price.toString(), 21600);
            props.setProperty(lastGoodKey, JSON.stringify({ price: price, ts: Date.now() }));
            return price;
          }
        }
        // Genuinely not found (a real 200 response, not a throttle) -- no
        // point retrying.
        break;
      }
      // data === null: non-200 or unparseable (throttle/timeout) -- retry.
    } catch (e) {
      // network error/timeout -- retry.
    }

    if (attempt < maxAttempts - 1) {
      Utilities.sleep(backoffMs[attempt]);
    }
  }

  // All attempts exhausted (or symbol genuinely unresolvable) -- degrade to
  // the last confirmed-good price rather than surfacing N/A/#VALUE!.
  const lastGoodRaw = props.getProperty(lastGoodKey);
  if (lastGoodRaw) {
    try {
      return JSON.parse(lastGoodRaw).price;
    } catch (e) {
      // corrupt stored value -- fall through to N/A
    }
  }

  return "N/A";
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
 * Fetches the current APY from Morpho vault
 * @param {string} vaultAddress - Optional vault address (defaults to Steakhouse USDC on mainnet)
 * @param {number} chainId - Optional chain ID (1=Ethereum, 8453=Base, 42161=Arbitrum, 10=Optimism)
 * @returns {number} The APY as a percentage (e.g., 5.13 for 5.13%)
 * @customfunction
 */
function MORPHO_APY(vaultAddress, chainId) {
  vaultAddress = vaultAddress || '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB';
  chainId = chainId || 1;
  
  const url = 'https://blue-api.morpho.org/graphql';
  
  const query = '{ vaultByAddress(address: "' + vaultAddress + '", chainId: ' + chainId + ') { state { netApy } } }';
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    if (!data.data || !data.data.vaultByAddress || !data.data.vaultByAddress.state) {
      return 'Error: Could not retrieve vault data. Check vault address and chain ID.';
    }
    
    const netApy = data.data.vaultByAddress.state.netApy;
    
    return Math.round(netApy * 10000) / 100;
  } catch (error) {
    return 'Error: ' + error.message;
  }
}

/**
 * Fetches detailed Morpho vault data
 * @param {string} vaultAddress - Optional vault address (defaults to Steakhouse USDC on mainnet)
 * @param {number} chainId - Optional chain ID (1=Ethereum, 8453=Base, 42161=Arbitrum, 10=Optimism)
 * @returns {Array} 2D array with vault data
 * @customfunction
 */
function MORPHO_DETAILS(vaultAddress, chainId) {
  vaultAddress = vaultAddress || '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB';
  chainId = chainId || 1;
  
  const url = 'https://blue-api.morpho.org/graphql';
  
  const query = '{ vaultByAddress(address: "' + vaultAddress + '", chainId: ' + chainId + ') { name symbol state { apy netApy netApyWithoutRewards totalAssetsUsd fee } } }';
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    if (!data.data || !data.data.vaultByAddress) {
      return [['Error', 'Could not retrieve vault data. Check vault address and chain ID.']];
    }
    
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
 * - Text containing a URL
 * - Rich text hyperlink (via cell reference lookup)
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
    
    // Check if the string contains a URL anywhere (including after newlines)
    // This handles cells where text and URL are on separate lines
    const urlMatch = input.match(/https?:\/\/[^\s"',)\n]+/);
    if (urlMatch) {
      return urlMatch[0];
    }
    
    // If input starts with http, it's a direct URL
    if (input.indexOf("http") === 0) {
      return input;
    }
    
    // Input doesn't contain a URL - try to find the rich text link
    // by looking up which cell is referencing this function
    try {
      const url = extractUrlFromCallingCell_(input);
      if (url) {
        return url;
      }
    } catch (e) {
      // SpreadsheetApp not available or lookup failed
    }
    
    return null;
  }
  
  return input;
}

/**
 * Attempts to find the URL from a rich text cell by examining the calling formula.
 * This searches for cells containing getAverageApy formulas that reference cells
 * with the given display text. Searches ALL sheets in the spreadsheet.
 * 
 * @param {string} displayText - The display text from the rich text cell
 * @returns {string|null} The extracted URL or null
 * @private
 */
function extractUrlFromCallingCell_(displayText) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();
  
  // Search all sheets for the formula
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    
    // Try using the active cell first (works in some contexts)
    if (sheet.getName() === spreadsheet.getActiveSheet().getName()) {
      const activeCell = sheet.getActiveCell();
      if (activeCell) {
        const formula = activeCell.getFormula();
        if (formula) {
          const url = extractUrlFromFormula_(sheet, formula, displayText);
          if (url) return url;
        }
      }
    }
    
    // Search the used range of each sheet
    const dataRange = sheet.getDataRange();
    const formulas = dataRange.getFormulas();
    
    for (let row = 0; row < formulas.length; row++) {
      for (let col = 0; col < formulas[row].length; col++) {
        const formula = formulas[row][col];
        if (formula && formula.toLowerCase().indexOf('getaverageapy') !== -1) {
          const url = extractUrlFromFormula_(sheet, formula, displayText);
          if (url) return url;
        }
      }
    }
  }
  
  return null;
}

/**
 * Extracts URL from a cell referenced in a getAverageApy formula.
 * 
 * @param {Sheet} sheet - The active sheet
 * @param {string} formula - The formula containing getAverageApy
 * @param {string} displayText - The display text to match
 * @returns {string|null} The extracted URL or null
 * @private
 */
function extractUrlFromFormula_(sheet, formula, displayText) {
  // Match cell references like A1, B2, Sheet1!A1, etc.
  const cellRefMatch = formula.match(/getAverageApy\s*\(\s*([A-Za-z0-9_]+!)?([A-Z]+[0-9]+)/i);
  if (!cellRefMatch) return null;
  
  const cellRef = cellRefMatch[2];
  const refCell = sheet.getRange(cellRef);
  
  // Verify this cell contains our display text
  const cellValue = refCell.getValue();
  if (cellValue !== displayText) return null;
  
  // Try to get rich text link
  const richText = refCell.getRichTextValue();
  if (richText) {
    const linkUrl = richText.getLinkUrl();
    if (linkUrl) return linkUrl;
    
    // Check individual runs for partial links
    const runs = richText.getRuns();
    for (let i = 0; i < runs.length; i++) {
      const runUrl = runs[i].getLinkUrl();
      if (runUrl) return runUrl;
    }
  }
  
  // Try HYPERLINK formula in the referenced cell
  const refFormula = refCell.getFormula();
  if (refFormula) {
    const hyperlinkMatch = refFormula.match(/=HYPERLINK\s*\(\s*"([^"]+)"/i);
    if (hyperlinkMatch) return hyperlinkMatch[1];
  }
  
  return null;
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
  let chainId = 1; // Default to Ethereum mainnet
  
  // Chain ID mapping for Morpho supported chains
  const chainIdMap = {
    'ethereum': 1,
    'base': 8453,
    'arbitrum': 42161,
    'optimism': 10,
    'polygon': 137
  };
  
  // Extract chain from URL: https://app.morpho.org/base/vault/0x...
  const chainMatch = url.match(/app\.morpho\.org\/([a-z]+)\/vault/);
  if (chainMatch && chainIdMap[chainMatch[1]]) {
    chainId = chainIdMap[chainMatch[1]];
  }
  
  // Extract vault address
  const vaultMatch = url.match(/vault\/([^/?]+)/);
  if (vaultMatch) {
    vaultAddress = vaultMatch[1];
  }
  
  const cache = CacheService.getScriptCache();
  const cacheKey = "morphoApyDecimal_" + chainId + "_" + vaultAddress;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return JSON.parse(cachedData).apy;
  }

  const apiUrl = 'https://blue-api.morpho.org/graphql';
  const query = '{ vaultByAddress(address: "' + vaultAddress + '", chainId: ' + chainId + ') { state { netApy } } }';
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const data = JSON.parse(response.getContentText());
    
    if (!data.data || !data.data.vaultByAddress || !data.data.vaultByAddress.state) {
      return 'Error: Could not retrieve vault data. Check vault address and chain.';
    }
    
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

/**
 * Internal: Fetches Avantis Finance APY via DeFiLlama with caching
 * Maps Avantis vault URLs to their DeFiLlama pool IDs
 * @param {string} url - The Avantis Finance URL
 * @param {number} days - Number of days to average
 * @returns {number} The APY as a decimal
 * @private
 */
function getAvantisApy_(url, days) {
  // Map Avantis vaults to DeFiLlama pool IDs
  // Currently Avantis has one main LP vault (USDC)
  const poolIdMap = {
    'avantis-vault': 'ae3397ed-1f0f-4aa4-ab62-44413ea8cd9e',
    'earn': 'ae3397ed-1f0f-4aa4-ab62-44413ea8cd9e'  // /earn page defaults to main vault
  };
  
  // Extract vault type from URL
  // https://www.avantisfi.com/earn/avantis-vault or https://www.avantisfi.com/earn
  let vaultType = 'earn';
  const vaultMatch = url.match(/earn\/([a-z-]+)/);
  if (vaultMatch) {
    vaultType = vaultMatch[1];
  }
  
  const poolId = poolIdMap[vaultType];
  if (!poolId) {
    return "Error: Unknown Avantis vault type. Supported: avantis-vault";
  }
  
  // Use DeFiLlama to fetch the APY data
  const defillamaUrl = "https://defillama.com/yields/pool/" + poolId;
  return getDefillamaAverageApy_(defillamaUrl, days);
}

/**
 * Internal: Fetches Pendle Finance APY with caching
 * Supports LP pools, PT (Principal Token), and YT (Yield Token) positions
 * @param {string} url - The Pendle Finance URL
 * @returns {number} The APY as a decimal (e.g., 0.12 for 12%)
 * @private
 */
function getPendleApy_(url) {
  // Chain ID mapping for Pendle supported chains
  const chainIdMap = {
    'ethereum': 1,
    'arbitrum': 42161,
    'base': 8453,
    'optimism': 10,
    'bsc': 56,
    'mantle': 5000,
    'sonic': 146,
    'berachain': 80094
  };
  
  // Extract chain from URL: https://app.pendle.finance/trade/pools/0x.../zap-in?chain=arbitrum
  // or https://app.pendle.finance/trade/dashboard/0x...?chain=ethereum
  let chainId = 1; // Default to Ethereum
  const chainMatch = url.match(/[?&]chain=([a-z]+)/i);
  if (chainMatch && chainIdMap[chainMatch[1].toLowerCase()]) {
    chainId = chainIdMap[chainMatch[1].toLowerCase()];
  }
  
  // Extract market address from URL
  // Patterns: /pools/0x.../... or /dashboard/0x... or /markets/0x...
  const addressMatch = url.match(/(?:pools|dashboard|markets)\/([0-9a-fA-Fx]+)/);
  if (!addressMatch) {
    return "Error: Could not extract market address from Pendle URL";
  }
  const marketAddress = addressMatch[1].toLowerCase();
  
  const cache = CacheService.getScriptCache();
  const cacheKey = "pendleApy_" + chainId + "_" + marketAddress;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return JSON.parse(cachedData).apy;
  }

  try {
    const apiUrl = "https://api-v2.pendle.finance/bff/v3/" + chainId + "/markets/" + marketAddress;
    const options = {
      method: 'get',
      headers: {
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const data = JSON.parse(response.getContentText());
    
    if (!data || data.error) {
      return "Error: " + (data.error || "Failed to fetch Pendle market data");
    }
    
    // Return the aggregated APY (includes underlying + PENDLE rewards + swap fees)
    // This is the most relevant APY for LP positions
    const apy = data.aggregatedApy || data.impliedApy || 0;
    
    cache.put(cacheKey, JSON.stringify({ apy: apy }), 21600); // Cache for 6 hours
    
    return apy;
  } catch (error) {
    return "Error: " + error.message;
  }
}

/**
 * Fetches the current APY from Pendle Finance market
 * @param {string} marketAddress - The market contract address
 * @param {number} chainId - Optional chain ID (1=Ethereum, 42161=Arbitrum, 8453=Base, 10=Optimism, 56=BSC, 5000=Mantle)
 * @param {string} apyType - Optional APY type: "aggregated" (default), "implied", "underlying", "pendle"
 * @returns {number} The APY as a percentage (e.g., 12.5 for 12.5%)
 * @customfunction
 */
function PENDLE_APY(marketAddress, chainId, apyType) {
  chainId = chainId || 1;
  apyType = apyType || "aggregated";
  
  const cache = CacheService.getScriptCache();
  const cacheKey = "pendleApyFull_" + chainId + "_" + marketAddress;
  const cachedData = cache.get(cacheKey);

  let data;
  
  if (cachedData) {
    data = JSON.parse(cachedData);
  } else {
    try {
      const apiUrl = "https://api-v2.pendle.finance/bff/v3/" + chainId + "/markets/" + marketAddress;
      const options = {
        method: 'get',
        headers: {
          'Accept': 'application/json'
        },
        muteHttpExceptions: true
      };
      
      const response = UrlFetchApp.fetch(apiUrl, options);
      data = JSON.parse(response.getContentText());
      
      if (!data || data.error) {
        return "Error: " + (data.error || "Failed to fetch Pendle market data");
      }
      
      cache.put(cacheKey, JSON.stringify(data), 21600);
    } catch (error) {
      return "Error: " + error.message;
    }
  }
  
  // Select APY based on type
  let apy;
  switch (apyType.toLowerCase()) {
    case "implied":
      apy = data.impliedApy;
      break;
    case "underlying":
      apy = data.underlyingApy;
      break;
    case "pendle":
      apy = data.pendleApy;
      break;
    case "swap":
    case "swapfee":
      apy = data.swapFeeApy;
      break;
    case "aggregated":
    default:
      apy = data.aggregatedApy;
      break;
  }
  
  return Math.round((apy || 0) * 10000) / 100; // Convert to percentage with 2 decimals
}

/**
 * Fetches detailed Pendle market data including all APY types
 * @param {string} marketAddress - The market contract address
 * @param {number} chainId - Optional chain ID (1=Ethereum, 42161=Arbitrum, 8453=Base, etc.)
 * @returns {Array} 2D array with market data
 * @customfunction
 */
function PENDLE_DETAILS(marketAddress, chainId) {
  chainId = chainId || 1;
  
  try {
    const apiUrl = "https://api-v2.pendle.finance/bff/v3/" + chainId + "/markets/" + marketAddress;
    const options = {
      method: 'get',
      headers: {
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const data = JSON.parse(response.getContentText());
    
    if (!data || data.error) {
      return [['Error', data.error || 'Failed to fetch market data']];
    }
    
    // Format expiry date
    const expiryDate = data.expiry ? new Date(data.expiry * 1000).toISOString().split('T')[0] : 'N/A';
    
    // Build results array
    const results = [
      ['Metric', 'Value'],
      ['Symbol', data.symbol || 'N/A'],
      ['Protocol', data.protocol || 'N/A'],
      ['Chain ID', chainId],
      ['Expiry Date', expiryDate],
      ['Aggregated APY', ((data.aggregatedApy || 0) * 100).toFixed(2) + '%'],
      ['Implied APY', ((data.impliedApy || 0) * 100).toFixed(2) + '%'],
      ['Underlying APY', ((data.underlyingApy || 0) * 100).toFixed(2) + '%'],
      ['PENDLE Reward APY', ((data.pendleApy || 0) * 100).toFixed(2) + '%'],
      ['Swap Fee APY', ((data.swapFeeApy || 0) * 100).toFixed(2) + '%'],
      ['PT Discount', ((data.ptDiscount || 0) * 100).toFixed(4) + '%'],
      ['Total Liquidity', '$' + formatNumber_(data.liquidity || 0)],
      ['TVL', '$' + formatNumber_(data.extendedInfo?.totalTvl || 0)],
      ['24h Volume', '$' + formatNumber_(data.tradingVolume || 0)],
      ['7d Volume', '$' + formatNumber_(data.tradingVolume7D || 0)],
      ['Is Active', data.isActive ? 'Yes' : 'No']
    ];
    
    return results;
  } catch (error) {
    return [['Error', error.message]];
  }
}

/**
 * Helper function to format large numbers
 * @private
 */
function formatNumber_(num) {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(2) + 'B';
  } else if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + 'M';
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(2) + 'K';
  }
  return num.toFixed(2);
}


// ============= DEFI LLAMA POOL SEARCH =============

/**
 * Searches DeFi Llama pools by name and returns the average APY
 * The first search caches all pools for 6 hours, subsequent searches are instant
 * Name-to-UUID mappings are cached separately for faster repeated lookups
 * 
 * @param {string} searchQuery - Search query (e.g., "STORM USDT", "Ethena sUSDe", "WooFi USDC Arbitrum")
 * @param {number} [days=30] - Number of days to average APY over (default: 30)
 * @return {number|string} The APY as a decimal (e.g., 0.0523 for 5.23%) or an error message
 * @customfunction
 */
function getAverageApyByName(searchQuery, days) {
  days = days || 30;
  
  if (!searchQuery || typeof searchQuery !== 'string') {
    return "Error: Please provide a search query";
  }
  
  // Check if this is a Fragmetric token first
  // Fragmetric tokens (fragSOL, fragJTO, etc.) are not properly listed on DeFiLlama
  // so we fetch directly from Fragmetric's API
  const fragmetricToken = matchFragmetricToken_(searchQuery);
  if (fragmetricToken) {
    const fragmetricApy = getFragmetricApy_(fragmetricToken);
    if (fragmetricApy !== null) {
      return fragmetricApy;
    }
    // If Fragmetric API fails, fall through to DeFiLlama as backup
  }
  
  // Try to get cached UUID for this search query
  const cache = CacheService.getScriptCache();
  const mappingCacheKey = "defiLlamaMapping_" + searchQuery.toLowerCase().replace(/\s+/g, '_');
  const cachedUuid = cache.get(mappingCacheKey);
  
  if (cachedUuid) {
    // We have a cached mapping, use it directly
    return getDefillamaAverageApy_("https://defillama.com/yields/pool/" + cachedUuid, days);
  }
  
  // Search for the pool
  const searchResult = searchDefiLlamaPool_(searchQuery);
  
  if (searchResult.error) {
    return searchResult.error;
  }
  
  // Cache the mapping for 30 days (max cache time)
  cache.put(mappingCacheKey, searchResult.poolId, 2592000);
  
  // Fetch the APY
  return getDefillamaAverageApy_("https://defillama.com/yields/pool/" + searchResult.poolId, days);
}

/**
 * Searches DeFi Llama pools and returns pool details without fetching APY
 * Useful for finding the right pool before using getAverageApyByName
 * 
 * @param {string} searchQuery - Search query (e.g., "STORM USDT", "Ethena", "WooFi")
 * @param {number} [maxResults=5] - Maximum number of results to return
 * @return {Array} 2D array with matching pools [Project, Symbol, Chain, TVL, APY, Pool ID]
 * @customfunction
 */
function DEFILLAMA_SEARCH(searchQuery, maxResults) {
  maxResults = maxResults || 5;
  
  if (!searchQuery || typeof searchQuery !== 'string') {
    return [["Error", "Please provide a search query"]];
  }
  
  const pools = getDefiLlamaPools_();
  if (pools.error) {
    return [["Error", pools.error]];
  }
  
  const matches = findMatchingPools_(pools, searchQuery, maxResults);
  
  if (matches.length === 0) {
    return [["No pools found matching", searchQuery]];
  }
  
  // Header row
  const results = [["Project", "Symbol", "Chain", "TVL (USD)", "APY (%)", "Pool ID"]];
  
  // Add matching pools
  for (let i = 0; i < matches.length; i++) {
    const pool = matches[i].pool;
    results.push([
      pool.project || "N/A",
      pool.symbol || "N/A",
      pool.chain || "N/A",
      pool.tvlUsd ? "$" + formatNumber_(pool.tvlUsd) : "N/A",
      pool.apy ? pool.apy.toFixed(2) + "%" : "N/A",
      pool.pool || "N/A"
    ]);
  }
  
  return results;
}

/**
 * Returns the current APY (not averaged) for a pool by name
 * 
 * @param {string} searchQuery - Search query (e.g., "STORM USDT", "Ethena sUSDe")
 * @return {number|string} The current APY as a decimal or an error message
 * @customfunction
 */
function getCurrentApyByName(searchQuery) {
  if (!searchQuery || typeof searchQuery !== 'string') {
    return "Error: Please provide a search query";
  }
  
  // Try to get cached UUID for this search query
  const cache = CacheService.getScriptCache();
  const mappingCacheKey = "defiLlamaMapping_" + searchQuery.toLowerCase().replace(/\s+/g, '_');
  const cachedUuid = cache.get(mappingCacheKey);
  
  let poolId;
  
  if (cachedUuid) {
    poolId = cachedUuid;
  } else {
    // Search for the pool
    const searchResult = searchDefiLlamaPool_(searchQuery);
    
    if (searchResult.error) {
      return searchResult.error;
    }
    
    poolId = searchResult.poolId;
    
    // Cache the mapping
    cache.put(mappingCacheKey, poolId, 2592000);
  }
  
  // Fetch current APY from the pools list (already cached)
  const pools = getDefiLlamaPools_();
  if (pools.error) {
    return pools.error;
  }
  
  for (let i = 0; i < pools.length; i++) {
    if (pools[i].pool === poolId) {
      return (pools[i].apy || 0) / 100;
    }
  }
  
  return "Error: Pool not found in current data";
}

/**
 * Internal: Searches for a DeFi Llama pool by name
 * @param {string} searchQuery - The search query
 * @returns {Object} Object with poolId or error
 * @private
 */
function searchDefiLlamaPool_(searchQuery) {
  const pools = getDefiLlamaPools_();
  
  if (pools.error) {
    return { error: pools.error };
  }
  
  const matches = findMatchingPools_(pools, searchQuery, 1);
  
  if (matches.length === 0) {
    return { error: "Error: No pools found matching '" + searchQuery + "'" };
  }
  
  return { poolId: matches[0].pool.pool };
}

/**
 * Internal: Fetches and caches all DeFi Llama pools
 * @returns {Array|Object} Array of pools or object with error property
 * @private
 */
function getDefiLlamaPools_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = "defiLlamaPools";
  
  // Try to get from cache first
  // Note: Cache has 100KB limit per key, so we may need to chunk
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch (e) {
      // Cache corrupted, refetch
    }
  }
  
  try {
    const response = UrlFetchApp.fetch("https://yields.llama.fi/pools");
    const jsonResponse = JSON.parse(response.getContentText());
    
    if (jsonResponse.status !== "success" || !jsonResponse.data) {
      return { error: "Failed to fetch DeFi Llama pools" };
    }
    
    // Filter to only include pools with meaningful data and reduce payload size
    const pools = jsonResponse.data
      .filter(function(pool) {
        return pool.tvlUsd > 10000; // Only pools with >$10k TVL
      })
      .map(function(pool) {
        return {
          pool: pool.pool,
          project: pool.project,
          symbol: pool.symbol,
          chain: pool.chain,
          tvlUsd: pool.tvlUsd,
          apy: pool.apy,
          apyBase: pool.apyBase,
          apyReward: pool.apyReward
        };
      });
    
    // Try to cache (may fail if too large)
    try {
      const poolsJson = JSON.stringify(pools);
      if (poolsJson.length < 100000) { // 100KB limit
        cache.put(cacheKey, poolsJson, 21600); // Cache for 6 hours
      }
    } catch (e) {
      // Cache too large, continue without caching full list
    }
    
    return pools;
  } catch (error) {
    return { error: "Failed to fetch pools: " + error.message };
  }
}

/**
 * Internal: Finds pools matching the search query
 * Uses fuzzy matching with scoring based on relevance
 * @param {Array} pools - Array of pool objects
 * @param {string} searchQuery - The search query
 * @param {number} maxResults - Maximum results to return
 * @returns {Array} Array of {pool, score} objects sorted by score
 * @private
 */
function findMatchingPools_(pools, searchQuery, maxResults) {
  const queryLower = searchQuery.toLowerCase();
  const queryTerms = queryLower.split(/[\s_-]+/).filter(function(t) { return t.length > 0; });
  
  const scored = [];
  
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    const score = calculatePoolMatchScore_(pool, queryLower, queryTerms);
    
    if (score > 0) {
      scored.push({ pool: pool, score: score });
    }
  }
  
  // Sort by score descending, then by TVL descending
  scored.sort(function(a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (b.pool.tvlUsd || 0) - (a.pool.tvlUsd || 0);
  });
  
  return scored.slice(0, maxResults);
}

/**
 * Internal: Calculates match score for a pool
 * @private
 */
function calculatePoolMatchScore_(pool, queryLower, queryTerms) {
  let score = 0;
  
  const projectLower = (pool.project || "").toLowerCase();
  const symbolLower = (pool.symbol || "").toLowerCase();
  const chainLower = (pool.chain || "").toLowerCase();
  const combined = projectLower + " " + symbolLower + " " + chainLower;
  
  // Exact match in symbol (highest priority)
  if (symbolLower === queryLower) {
    score += 1000;
  }
  
  // Exact match in project
  if (projectLower === queryLower) {
    score += 800;
  }
  
  // Symbol contains full query
  if (symbolLower.indexOf(queryLower) !== -1) {
    score += 500;
  }
  
  // Project contains full query
  if (projectLower.indexOf(queryLower) !== -1) {
    score += 400;
  }
  
  // Check each query term
  let matchedTerms = 0;
  for (let i = 0; i < queryTerms.length; i++) {
    const term = queryTerms[i];
    
    if (symbolLower.indexOf(term) !== -1) {
      score += 100;
      matchedTerms++;
    } else if (projectLower.indexOf(term) !== -1) {
      score += 80;
      matchedTerms++;
    } else if (chainLower.indexOf(term) !== -1) {
      score += 50;
      matchedTerms++;
    } else if (combined.indexOf(term) !== -1) {
      score += 30;
      matchedTerms++;
    }
  }
  
  // Bonus for matching all terms
  if (matchedTerms === queryTerms.length && queryTerms.length > 1) {
    score += 200;
  }
  
  // TVL bonus (prefer larger pools)
  if (pool.tvlUsd > 10000000) { // >$10M
    score += 50;
  } else if (pool.tvlUsd > 1000000) { // >$1M
    score += 30;
  } else if (pool.tvlUsd > 100000) { // >$100K
    score += 10;
  }
  
  return score;
}

/**
 * Clears the DeFi Llama pool cache and name mappings
 * Use this if you want to force a refresh of pool data
 * @customfunction
 */
function clearDefiLlamaCache() {
  const cache = CacheService.getScriptCache();
  cache.remove("defiLlamaPools");
  return "Cache cleared. Next search will fetch fresh data.";
}


// ============= FRAGMETRIC API =============

/**
 * Fragmetric token mappings - maps search queries to Fragmetric token symbols
 * @private
 */
var FRAGMETRIC_TOKENS = {
  'fragsol': 'fragSOL',
  'fragjto': 'fragJTO',
  'fragbtc': 'fragBTC',
  'fragswtch': 'fragSWTCH',
  'frag2': 'FRAG2',
  'frag²': 'FRAG2',
  'fragmetric sol': 'fragSOL',
  'fragmetric jto': 'fragJTO',
  'fragmetric btc': 'fragBTC',
  'fragmetric swtch': 'fragSWTCH'
};

/**
 * Gets the current APY for a Fragmetric restaking token
 * Fetches directly from Fragmetric's GraphQL API
 * 
 * @param {string} tokenSymbol - Token symbol (e.g., "fragSOL", "fragJTO", "fragBTC", "fragSWTCH", "FRAG²")
 * @return {number|null} The APY as a decimal (e.g., 0.0741 for 7.41%) or null if not found
 * @private
 */
function getFragmetricApy_(tokenSymbol) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "fragmetric_" + tokenSymbol.toLowerCase();
  
  // Check cache first (cache for 1 hour)
  const cachedApy = cache.get(cacheKey);
  if (cachedApy !== null) {
    return parseFloat(cachedApy);
  }
  
  try {
    const response = UrlFetchApp.fetch("https://api.fragmetric.xyz/v1/graphql", {
      method: "POST",
      contentType: "application/json",
      headers: {
        "Origin": "https://app.fragmetric.xyz",
        "Referer": "https://app.fragmetric.xyz/"
      },
      payload: JSON.stringify({
        operationName: "restakingFund",
        variables: {},
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: "4b895772381ddd54b24463d1475125844c8a756b9cd3d844bb1b3ebd1846e359"
          }
        }
      })
    });
    
    const data = JSON.parse(response.getContentText());
    
    if (!data.data || !data.data.restakingFunds) {
      return null;
    }
    
    // Find the matching token
    for (let i = 0; i < data.data.restakingFunds.length; i++) {
      const fund = data.data.restakingFunds[i];
      if (fund.receiptToken && fund.receiptToken.metadata) {
        const metadata = fund.receiptToken.metadata;
        if (metadata.symbol.toLowerCase() === tokenSymbol.toLowerCase() ||
            metadata.symbol === tokenSymbol) {
          // Fragmetric API returns APY as decimal (0.07412984 = 7.41%)
          // We need to return it as decimal for percentage (0.0741 = 7.41%)
          const apy = metadata.apy;
          
          // Cache for 1 hour
          cache.put(cacheKey, apy.toString(), 3600);
          
          return apy;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.log("Error fetching Fragmetric APY: " + error.message);
    return null;
  }
}

/**
 * Checks if a search query matches a Fragmetric token
 * @param {string} searchQuery - The search query
 * @return {string|null} The Fragmetric token symbol or null
 * @private
 */
function matchFragmetricToken_(searchQuery) {
  const queryLower = searchQuery.toLowerCase().trim();
  
  // Direct match
  if (FRAGMETRIC_TOKENS[queryLower]) {
    return FRAGMETRIC_TOKENS[queryLower];
  }
  
  // Check if query contains fragmetric token names
  for (var key in FRAGMETRIC_TOKENS) {
    if (queryLower.indexOf(key) !== -1) {
      return FRAGMETRIC_TOKENS[key];
    }
  }
  
  return null;
}

/**
 * Gets the current APY for a Fragmetric token by name
 * This is a public function that can be called directly
 * 
 * @param {string} tokenName - Token name (e.g., "fragSOL", "fragJTO", "fragBTC")
 * @return {number|string} The APY as a decimal or an error message
 * @customfunction
 */
function getFragmetricApy(tokenName) {
  if (!tokenName || typeof tokenName !== 'string') {
    return "Error: Please provide a token name (fragSOL, fragJTO, fragBTC, fragSWTCH, FRAG2)";
  }
  
  const token = matchFragmetricToken_(tokenName);
  if (!token) {
    return "Error: Unknown Fragmetric token. Valid tokens: fragSOL, fragJTO, fragBTC, fragSWTCH, FRAG2";
  }
  
  const apy = getFragmetricApy_(token);
  if (apy === null) {
    return "Error: Failed to fetch APY from Fragmetric";
  }
  
  return apy;
}


// ============= MENU =============

/**
 * Creates a custom menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('DeFi & Crypto')
    .addItem('Refresh APY from selected cell', 'refreshApyFromSelectedCell')
    .addItem('Refresh Maple APY', 'insertMapleApy')
    .addItem('Refresh Morpho APY', 'insertMorphoApy')
    .addItem('Refresh All APYs', 'insertAllApys')
    .addSeparator()
    .addItem('Search DeFi Llama pools', 'showPoolSearchDialog')
    .addItem('Clear DeFi Llama cache', 'clearDefiLlamaCacheMenu')
    .addToUi();
}

/**
 * Shows a dialog to search DeFi Llama pools
 */
function showPoolSearchDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Search DeFi Llama Pools',
    'Enter search query (e.g., "storm usdt", "ethena susde", "woofi arbitrum"):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  
  const query = result.getResponseText().trim();
  if (!query) {
    ui.alert('Please enter a search query.');
    return;
  }
  
  const results = DEFILLAMA_SEARCH(query, 10);
  
  // Insert results into the sheet
  const sheet = SpreadsheetApp.getActiveSheet();
  const cell = sheet.getActiveCell();
  const range = sheet.getRange(cell.getRow(), cell.getColumn(), results.length, results[0].length);
  range.setValues(results);
  
  ui.alert('Found ' + (results.length - 1) + ' pools. Results inserted at ' + cell.getA1Notation());
}

/**
 * Menu wrapper for clearing DeFi Llama cache
 */
function clearDefiLlamaCacheMenu() {
  clearDefiLlamaCache();
  SpreadsheetApp.getUi().alert('DeFi Llama cache cleared. Next search will fetch fresh data.');
}

/**
 * Reads the hyperlink from the selected cell and writes the APY to the cell to the right.
 * This function works via menu (has full authorization) and can read rich text hyperlinks.
 * 
 * Usage:
 * 1. Select a cell containing a hyperlink (e.g., "Morpho USDC" with link to vault URL)
 * 2. Click DeFi & Crypto > Refresh APY from selected cell
 * 3. The APY will be written to the cell immediately to the right
 */
function refreshApyFromSelectedCell() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const cell = sheet.getActiveCell();
  
  if (!cell) {
    SpreadsheetApp.getUi().alert('Please select a cell first.');
    return;
  }
  
  const url = extractUrlFromCell_(cell);
  
  if (!url) {
    const cellValue = cell.getValue();
    SpreadsheetApp.getUi().alert(
      'No URL found in selected cell.\n\n' +
      'Cell value: ' + (cellValue || '(empty)') + '\n\n' +
      'Make sure the cell contains:\n' +
      '- A hyperlink (Insert > Link), or\n' +
      '- A =HYPERLINK() formula, or\n' +
      '- A plain URL'
    );
    return;
  }
  
  const apy = getAverageApy(url, 30);
  
  // Write to the cell to the right
  const outputCell = sheet.getRange(cell.getRow(), cell.getColumn() + 1);
  outputCell.setValue(apy);
  
  // Show confirmation
  if (typeof apy === 'number') {
    SpreadsheetApp.getUi().alert('APY: ' + (apy * 100).toFixed(2) + '%\n\nWritten to cell ' + outputCell.getA1Notation());
  } else {
    SpreadsheetApp.getUi().alert('Result: ' + apy + '\n\nWritten to cell ' + outputCell.getA1Notation());
  }
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
  console.log("Morpho (Ethereum):", getAverageApy("https://app.morpho.org/vault/0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB"));
  console.log("Morpho (Base):", getAverageApy("https://app.morpho.org/base/vault/0xB7890CEE6CF4792cdCC13489D36D9d42726ab863/universal-usdc"));
  console.log("Beefy:", getAverageApy("https://app.beefy.com/vault/compound-base-usdc"));
  console.log("DeFiLlama:", getAverageApy("https://defillama.com/yields/pool/e2f0e83e-e07b-44bd-9718-e25b96295468"));
  console.log("Palette/TON:", getAverageApy("https://yield.palette.finance/pools/EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r"));
  console.log("DeDust/TON:", getAverageApy("https://app.dedust.io/pools/EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r"));
  console.log("Pendle (ETH USDe):", getAverageApy("https://app.pendle.finance/trade/dashboard/0x4eaa571eafcd96f51728756bd7f396459bb9b869?chain=ethereum"));
}

/**
 * DEBUG: Test rich text URL extraction from a specific cell.
 * Run this from the Apps Script editor (not as a custom function) to debug.
 * 
 * Instructions:
 * 1. Change the cellAddress and sheetName below to match your cell
 * 2. Run this function from the Apps Script editor (Run > testRichTextExtraction)
 * 3. Check the Execution Log for results
 */
function testRichTextExtraction() {
  // CHANGE THESE VALUES to match your cell with the hyperlink
  const cellAddress = "A10";  // Change to your cell address
  const sheetName = "";       // Leave empty for active sheet, or set like "Sheet1"
  
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet;
  
  if (sheetName) {
    sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      console.log("ERROR: Sheet '" + sheetName + "' not found!");
      console.log("Available sheets:", spreadsheet.getSheets().map(s => s.getName()));
      return;
    }
  } else {
    sheet = spreadsheet.getActiveSheet();
  }
  
  console.log("Testing cell: " + cellAddress + " on sheet: " + sheet.getName());
  
  const cell = sheet.getRange(cellAddress);
  
  // Test 1: Get cell value
  const value = cell.getValue();
  console.log("1. Cell value:", value);
  console.log("   Type:", typeof value);
  
  // Test 2: Get formula
  const formula = cell.getFormula();
  console.log("2. Cell formula:", formula || "(no formula)");
  
  // Test 3: Get rich text
  const richText = cell.getRichTextValue();
  console.log("3. Has rich text:", !!richText);
  
  if (richText) {
    // Test 3a: Get link from entire text
    const linkUrl = richText.getLinkUrl();
    console.log("   3a. Full text link URL:", linkUrl || "(none)");
    
    // Test 3b: Get text content
    const text = richText.getText();
    console.log("   3b. Text content:", text);
    
    // Test 3c: Check individual runs
    const runs = richText.getRuns();
    console.log("   3c. Number of runs:", runs.length);
    
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const runText = run.getText();
      const runUrl = run.getLinkUrl();
      console.log("       Run " + i + ": text='" + runText + "', url=" + (runUrl || "(none)"));
    }
  }
  
  // Test 4: List all sheets
  console.log("\n4. All sheets in this spreadsheet:");
  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    console.log("   " + i + ": " + sheets[i].getName());
  }
  
  // Test 5: Try the extraction function
  console.log("\n5. Testing extractUrlFromCell_():");
  try {
    const extractedUrl = extractUrlFromCell_(cell);
    console.log("   Extracted URL:", extractedUrl || "(none)");
  } catch (e) {
    console.log("   ERROR:", e.message);
  }
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

/**
 * Test function for Pendle APY
 */
function testPendleApy() {
  // Test with URL (Ethereum USDe market)
  console.log("Pendle URL (ETH USDe):", getAverageApy("https://app.pendle.finance/trade/dashboard/0x4eaa571eafcd96f51728756bd7f396459bb9b869?chain=ethereum"));
  
  // Test direct function with market address
  console.log("PENDLE_APY (ETH USDe):", PENDLE_APY("0x4eaa571eafcd96f51728756bd7f396459bb9b869", 1));
  console.log("PENDLE_APY implied:", PENDLE_APY("0x4eaa571eafcd96f51728756bd7f396459bb9b869", 1, "implied"));
  
  // Test details
  console.log("PENDLE_DETAILS:", PENDLE_DETAILS("0x4eaa571eafcd96f51728756bd7f396459bb9b869", 1));
}

/**
 * Test function for DeFi Llama pool search
 */
function testDefiLlamaSearch() {
  console.log("\n=== Testing DEFILLAMA_SEARCH ===");
  
  // Test search for Storm USDT
  console.log("\n1. Search for 'storm usdt':");
  const stormResults = DEFILLAMA_SEARCH("storm usdt", 5);
  stormResults.forEach(function(row) { console.log("   " + row.join(" | ")); });
  
  // Test search for Ethena sUSDe
  console.log("\n2. Search for 'ethena susde':");
  const ethenaResults = DEFILLAMA_SEARCH("ethena susde", 3);
  ethenaResults.forEach(function(row) { console.log("   " + row.join(" | ")); });
  
  // Test search for WooFi
  console.log("\n3. Search for 'woofi usdc arbitrum':");
  const woofiResults = DEFILLAMA_SEARCH("woofi usdc arbitrum", 3);
  woofiResults.forEach(function(row) { console.log("   " + row.join(" | ")); });
  
  console.log("\n=== Testing getAverageApyByName ===");
  
  // Test APY fetch by name (30-day average)
  const stormAvg = getAverageApyByName("storm usdt", 30);
  console.log("\n4. getAverageApyByName('storm usdt', 30):", stormAvg);
  console.log("   As percentage:", typeof stormAvg === 'number' ? (stormAvg * 100).toFixed(2) + "%" : stormAvg);
  
  const ethenaAvg = getAverageApyByName("ethena susde", 30);
  console.log("\n5. getAverageApyByName('ethena susde', 30):", ethenaAvg);
  console.log("   As percentage:", typeof ethenaAvg === 'number' ? (ethenaAvg * 100).toFixed(2) + "%" : ethenaAvg);
  
  console.log("\n=== Testing getCurrentApyByName ===");
  
  // Test current APY (not averaged) - this returns the spot rate from the pool list
  const stormCurrent = getCurrentApyByName("storm usdt");
  console.log("\n6. getCurrentApyByName('storm usdt'):", stormCurrent);
  console.log("   As percentage:", typeof stormCurrent === 'number' ? (stormCurrent * 100).toFixed(2) + "%" : stormCurrent);
  
  const ethenaCurrent = getCurrentApyByName("ethena susde");
  console.log("\n7. getCurrentApyByName('ethena susde'):", ethenaCurrent);
  console.log("   As percentage:", typeof ethenaCurrent === 'number' ? (ethenaCurrent * 100).toFixed(2) + "%" : ethenaCurrent);
  
  console.log("\n=== Testing cached lookups (should be faster) ===");
  
  // Second call should use cached UUID
  const startTime = new Date().getTime();
  const stormCached = getAverageApyByName("storm usdt", 30);
  const endTime = new Date().getTime();
  console.log("\n8. getAverageApyByName('storm usdt', 30) [cached]:", stormCached);
  console.log("   Time taken:", (endTime - startTime) + "ms");
  
  console.log("\n=== Test Summary ===");
  console.log("Note: DeFi Llama APY values may differ from values shown on protocol websites.");
  console.log("Storm Trade shows ~10% on their site but DeFi Llama shows ~3-4%.");
  console.log("This is due to different calculation methodologies.");
}

/**
 * Test function for Fragmetric APY
 * This tests that fragSOL returns the native Fragmetric yield (~7%) 
 * and NOT the DeFiLlama WFRAGSOL LP pool (~0.07%)
 */
function testFragmetricApy() {
  console.log("\n=== Testing Fragmetric APY ===");
  
  // Test 1: Direct Fragmetric API call
  console.log("\n1. Testing getFragmetricApy() direct function:");
  const tokens = ['fragSOL', 'fragJTO', 'fragBTC', 'fragSWTCH', 'FRAG2'];
  tokens.forEach(function(token) {
    const apy = getFragmetricApy(token);
    console.log("   " + token + ": " + (typeof apy === 'number' ? (apy * 100).toFixed(2) + "%" : apy));
  });
  
  // Test 2: getAverageApyByName should use Fragmetric API for fragSOL
  console.log("\n2. Testing getAverageApyByName('fragSOL') - should return ~7%, NOT ~0.07%:");
  const fragSolApy = getAverageApyByName("fragSOL");
  console.log("   Result: " + (typeof fragSolApy === 'number' ? (fragSolApy * 100).toFixed(2) + "%" : fragSolApy));
  
  // Validate it's the correct value (should be > 1% for native fragSOL staking)
  if (typeof fragSolApy === 'number') {
    if (fragSolApy > 0.01) {
      console.log("   ✓ PASS: APY is > 1% - correctly using Fragmetric native API");
    } else {
      console.log("   ✗ FAIL: APY is < 1% - likely incorrectly using DeFiLlama WFRAGSOL LP pool!");
    }
  }
  
  // Test 3: Show what DeFiLlama returns for comparison (should be WFRAGSOL from loopscale)
  console.log("\n3. DeFiLlama search for 'fragSOL' (for comparison - this is the WRONG pool):");
  const defiLlamaResults = DEFILLAMA_SEARCH("fragSOL", 3);
  defiLlamaResults.forEach(function(row) { console.log("   " + row.join(" | ")); });
  
  // Test 4: Verify the DeFiLlama pool UUID that would be matched
  console.log("\n4. Verifying DeFiLlama pool that WOULD match 'fragSOL' (incorrect pool):");
  const searchResult = searchDefiLlamaPool_("fragSOL");
  if (searchResult.poolId) {
    console.log("   Pool ID: " + searchResult.poolId);
    console.log("   Expected (loopscale WFRAGSOL): 4eb36cd9-92c4-46b5-8072-1593fcee4f60");
    
    // Fetch the pool details to show it's the wrong one
    const pools = getDefiLlamaPools_();
    if (!pools.error) {
      for (var i = 0; i < pools.length; i++) {
        if (pools[i].pool === searchResult.poolId) {
          console.log("   Project: " + pools[i].project);
          console.log("   Symbol: " + pools[i].symbol);
          console.log("   APY: " + (pools[i].apy ? pools[i].apy.toFixed(4) + "%" : "N/A"));
          console.log("   This is " + (pools[i].project === 'fragmetric' ? "Fragmetric native" : "NOT Fragmetric native (LP/lending pool)"));
          break;
        }
      }
    }
  } else {
    console.log("   " + searchResult.error);
  }
  
  // Test 5: Test case variations
  console.log("\n5. Testing case variations:");
  console.log("   'FRAGSOL': " + formatApyResult_(getAverageApyByName("FRAGSOL")));
  console.log("   'FragSOL': " + formatApyResult_(getAverageApyByName("FragSOL")));
  console.log("   'fragmetric sol': " + formatApyResult_(getAverageApyByName("fragmetric sol")));
  
  // Test 6: Other Fragmetric tokens via getAverageApyByName
  console.log("\n6. Other Fragmetric tokens via getAverageApyByName:");
  console.log("   'fragJTO': " + formatApyResult_(getAverageApyByName("fragJTO")));
  console.log("   'fragBTC': " + formatApyResult_(getAverageApyByName("fragBTC")));
  console.log("   'fragSWTCH': " + formatApyResult_(getAverageApyByName("fragSWTCH")));
  
  console.log("\n=== Fragmetric Test Summary ===");
  console.log("fragSOL native APY from Fragmetric should be ~7-8%");
  console.log("DeFiLlama WFRAGSOL (loopscale LP) is ~0.07% - this is a different product!");
  console.log("The fix ensures getAverageApyByName('fragSOL') returns the native Fragmetric APY.");
}

/**
 * Helper to format APY result for test output
 * @private
 */
function formatApyResult_(apy) {
  return typeof apy === 'number' ? (apy * 100).toFixed(2) + "%" : apy;
}


