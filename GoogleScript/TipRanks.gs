const TIPRANKS_CACHE_DURATION = 86400; // 24 hours

/**
 * Get analyst price target for a stock symbol
 * @param {string} symbol - Stock ticker symbol
 * @return {number|string} Mean price target or error
 * @customfunction
 */
function PRICE_TARGET(symbol) {
  if (!symbol) return "No symbol";
  symbol = symbol.toString().toUpperCase().trim();
  
  const cache = CacheService.getScriptCache();
  const cacheKey = "PT_" + symbol;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    const value = parseFloat(cached);
    return isNaN(value) ? cached : value;
  }
  
  let result = null;
  
  // Try Nasdaq API first (most reliable and fastest)
  result = getNasdaqPriceTarget(symbol);
  
  // Fallback to FinViz
  if (!result) {
    result = getFinVizPriceTarget(symbol);
  }
  
  // Fallback to MarketWatch
  if (!result) {
    result = getMarketWatchPriceTarget(symbol);
  }
  
  // Fallback to Yahoo Finance
  if (!result) {
    result = getYahooPriceTarget(symbol);
  }
  
  // Last resort: TipRanks (often blocked, slowest)
  if (!result) {
    result = getTipRanksPriceTarget(symbol);
  }
  
  if (result) {
    cache.put(cacheKey, result.toString(), TIPRANKS_CACHE_DURATION);
    return result;
  }
  
  return "N/A";
}

/**
 * Get full price target details (mean, high, low, # analysts)
 * @param {string} symbol - Stock ticker
 * @param {string} field - "mean", "high", "low", "median", "count", "buy", "hold", "sell", "rating"
 * @return {number|string}
 * @customfunction
 */
function PRICE_TARGET_DETAIL(symbol, field) {
  if (!symbol) return "No symbol";
  symbol = symbol.toString().toUpperCase().trim();
  field = (field || "mean").toString().toLowerCase();
  
  const cache = CacheService.getScriptCache();
  const cacheKey = "PTD_" + symbol;
  
  let data;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    data = JSON.parse(cached);
  } else {
    // Try Nasdaq API first (most reliable and fastest)
    data = getNasdaqFullData(symbol);
    
    // Fallback to FinViz
    if (!data) {
      data = getFinVizFullData(symbol);
    }
    
    // Fallback to MarketWatch
    if (!data) {
      data = getMarketWatchFullData(symbol);
    }
    
    // Fallback to Yahoo Finance
    if (!data) {
      data = getYahooFullData(symbol);
    }
    
    // Last resort: TipRanks (often blocked)
    if (!data) {
      data = getTipRanksFullData(symbol);
    }
    
    if (data) {
      cache.put(cacheKey, JSON.stringify(data), TIPRANKS_CACHE_DURATION);
    }
  }
  
  if (!data) return "N/A";
  
  switch(field) {
    case "mean": return data.mean || "N/A";
    case "high": return data.high || "N/A";
    case "low": return data.low || "N/A";
    case "median": return data.median || "N/A";
    case "count": return data.count || "N/A";
    case "buy": return data.buy || "N/A";
    case "hold": return data.hold || "N/A";
    case "sell": return data.sell || "N/A";
    case "rating": return data.rating || "N/A";
    default: return data.mean || "N/A";
  }
}

/**
 * Get analyst rating for a stock (Strong Buy, Buy, Hold, Sell)
 * @param {string} symbol - Stock ticker symbol
 * @return {string} Analyst consensus rating
 * @customfunction
 */
function ANALYST_RATING(symbol) {
  return PRICE_TARGET_DETAIL(symbol, "rating");
}

// ============= TIPRANKS (USER PREFERRED) =============

/**
 * Get price target from TipRanks
 * TipRanks uses JavaScript rendering, so we scrape from their static HTML
 * URL: https://www.tipranks.com/stocks/{symbol}/forecast
 */
function getTipRanksPriceTarget(symbol) {
  try {
    const data = getTipRanksFullData(symbol);
    return data ? data.mean : null;
  } catch (e) {
    console.log("TipRanks error for " + symbol + ": " + e.message);
    return null;
  }
}

/**
 * Get full analyst data from TipRanks
 * Returns: { mean, high, low, count, buy, hold, sell, rating }
 */
function getTipRanksFullData(symbol) {
  try {
    const url = `https://www.tipranks.com/stocks/${symbol.toLowerCase()}/forecast`;
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    });
    
    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      console.log("TipRanks returned status: " + responseCode);
      return null;
    }
    
    const html = response.getContentText();
    
    // TipRanks embeds data in the page - look for various patterns
    const data = {};
    
    // Pattern 1: Look for "average price target is $XXX.XX"
    const avgMatch = html.match(/average price target is \$([0-9,.]+)/i);
    if (avgMatch) {
      data.mean = parseFloat(avgMatch[1].replace(/,/g, ''));
    }
    
    // Pattern 2: Look for "high forecast of $XXX.XX"
    const highMatch = html.match(/high forecast of \$([0-9,.]+)/i);
    if (highMatch) {
      data.high = parseFloat(highMatch[1].replace(/,/g, ''));
    }
    
    // Pattern 3: Look for "low forecast of $XXX.XX"
    const lowMatch = html.match(/low forecast of \$([0-9,.]+)/i);
    if (lowMatch) {
      data.low = parseFloat(lowMatch[1].replace(/,/g, ''));
    }
    
    // Pattern 4: Look for analyst count "Based on XX analysts" or "Based on XX Wall Street analysts"
    const countMatch = html.match(/Based on (\d+) (?:Wall Street )?analysts/i);
    if (countMatch) {
      data.count = parseInt(countMatch[1]);
    }
    
    // Pattern 5: Look for buy/hold/sell counts "X Buy X Hold X Sell"
    const ratingsMatch = html.match(/(\d+)\s*Buy\s+(\d+)\s*Hold\s+(\d+)\s*Sell/i);
    if (ratingsMatch) {
      data.buy = parseInt(ratingsMatch[1]);
      data.hold = parseInt(ratingsMatch[2]);
      data.sell = parseInt(ratingsMatch[3]);
    }
    
    // Pattern 6: Look for rating text (Strong Buy, Moderate Buy, Hold, etc.)
    const ratingMatch = html.match(/(Strong Buy|Moderate Buy|Buy|Hold|Moderate Sell|Sell|Strong Sell)/i);
    if (ratingMatch) {
      data.rating = ratingMatch[1];
    }
    
    // Pattern 7: Alternative - look for JSON data in script tags
    if (!data.mean) {
      // Try to find price target in Next.js data or other embedded JSON
      const jsonMatch = html.match(/"priceTarget":\s*([0-9.]+)/i);
      if (jsonMatch) {
        data.mean = parseFloat(jsonMatch[1]);
      }
    }
    
    // Pattern 8: Look for "Average Price Target $XXX.XX"
    if (!data.mean) {
      const altAvgMatch = html.match(/Average Price Target[^$]*\$([0-9,.]+)/i);
      if (altAvgMatch) {
        data.mean = parseFloat(altAvgMatch[1].replace(/,/g, ''));
      }
    }
    
    // Pattern 9: Look for "Highest Price Target $XXX.XX"
    if (!data.high) {
      const altHighMatch = html.match(/Highest Price Target[^$]*\$([0-9,.]+)/i);
      if (altHighMatch) {
        data.high = parseFloat(altHighMatch[1].replace(/,/g, ''));
      }
    }
    
    // Pattern 10: Look for "Lowest Price Target $XXX.XX"
    if (!data.low) {
      const altLowMatch = html.match(/Lowest Price Target[^$]*\$([0-9,.]+)/i);
      if (altLowMatch) {
        data.low = parseFloat(altLowMatch[1].replace(/,/g, ''));
      }
    }
    
    // Validate we got at least the mean price target
    if (data.mean && !isNaN(data.mean)) {
      return {
        mean: data.mean,
        high: data.high || data.mean,
        low: data.low || data.mean,
        count: data.count || (data.buy || 0) + (data.hold || 0) + (data.sell || 0) || 1,
        buy: data.buy || 0,
        hold: data.hold || 0,
        sell: data.sell || 0,
        rating: data.rating || "N/A",
        source: "TipRanks"
      };
    }
    
    console.log("TipRanks: Could not parse price target data for " + symbol);
    return null;
  } catch (e) {
    console.log("TipRanks full data error for " + symbol + ": " + e.message);
    return null;
  }
}

/**
 * Direct TipRanks price target function
 * @param {string} symbol - Stock ticker symbol
 * @return {number|string} Price target from TipRanks
 * @customfunction
 */
function TIPRANKS_PRICE_TARGET(symbol) {
  if (!symbol) return "No symbol";
  symbol = symbol.toString().toUpperCase().trim();
  
  const cache = CacheService.getScriptCache();
  const cacheKey = "TR_PT_" + symbol;
  
  const cached = cache.get(cacheKey);
  if (cached) {
    const value = parseFloat(cached);
    return isNaN(value) ? cached : value;
  }
  
  const result = getTipRanksPriceTarget(symbol);
  
  if (result) {
    cache.put(cacheKey, result.toString(), TIPRANKS_CACHE_DURATION);
    return result;
  }
  
  return "N/A";
}

/**
 * Get detailed TipRanks data
 * @param {string} symbol - Stock ticker symbol
 * @param {string} field - "mean", "high", "low", "count", "buy", "hold", "sell", "rating"
 * @return {number|string}
 * @customfunction
 */
function TIPRANKS_DETAIL(symbol, field) {
  if (!symbol) return "No symbol";
  symbol = symbol.toString().toUpperCase().trim();
  field = (field || "mean").toString().toLowerCase();
  
  const cache = CacheService.getScriptCache();
  const cacheKey = "TR_FULL_" + symbol;
  
  let data;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    data = JSON.parse(cached);
  } else {
    data = getTipRanksFullData(symbol);
    if (data) {
      cache.put(cacheKey, JSON.stringify(data), TIPRANKS_CACHE_DURATION);
    }
  }
  
  if (!data) return "N/A";
  
  switch(field) {
    case "mean": return data.mean || "N/A";
    case "high": return data.high || "N/A";
    case "low": return data.low || "N/A";
    case "count": return data.count || "N/A";
    case "buy": return data.buy || "N/A";
    case "hold": return data.hold || "N/A";
    case "sell": return data.sell || "N/A";
    case "rating": return data.rating || "N/A";
    default: return data.mean || "N/A";
  }
}

function testTipRanks() {
  console.log("Testing TipRanks directly:");
  
  const symbols = ["COIN", "AAPL", "MSFT", "NVDA"];
  
  symbols.forEach(symbol => {
    console.log("\n--- " + symbol + " ---");
    const data = getTipRanksFullData(symbol);
    if (data) {
      console.log("Mean: $" + data.mean);
      console.log("High: $" + data.high);
      console.log("Low: $" + data.low);
      console.log("Analysts: " + data.count + " (Buy: " + data.buy + ", Hold: " + data.hold + ", Sell: " + data.sell + ")");
      console.log("Rating: " + data.rating);
    } else {
      console.log("No data available");
    }
  });
}

// ============= NASDAQ API (PRIMARY SOURCE) =============

/**
 * Get price target from Nasdaq API
 * This is the most reliable source - returns JSON data
 * URL: https://api.nasdaq.com/api/analyst/{symbol}/targetprice
 */
function getNasdaqPriceTarget(symbol) {
  try {
    const data = getNasdaqFullData(symbol);
    return data ? data.mean : null;
  } catch (e) {
    console.log("Nasdaq API error for " + symbol + ": " + e.message);
    return null;
  }
}

/**
 * Get full analyst data from Nasdaq API
 * Returns: { mean, median, high, low, count, buy, hold, sell, rating }
 */
function getNasdaqFullData(symbol) {
  try {
    const url = `https://api.nasdaq.com/api/analyst/${symbol.toUpperCase()}/targetprice`;
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    
    if (response.getResponseCode() !== 200) {
      console.log("Nasdaq API returned status: " + response.getResponseCode());
      return null;
    }
    
    const json = JSON.parse(response.getContentText());
    
    if (!json.data || !json.data.consensusOverview) {
      console.log("Nasdaq API: No consensus data for " + symbol);
      return null;
    }
    
    const consensus = json.data.consensusOverview;
    const buy = consensus.buy || 0;
    const hold = consensus.hold || 0;
    const sell = consensus.sell || 0;
    const totalAnalysts = buy + hold + sell;
    
    // Determine rating based on buy/hold/sell distribution
    let rating = "Hold";
    if (buy > hold + sell) rating = "Buy";
    if (buy > (hold + sell) * 2) rating = "Strong Buy";
    if (sell > buy + hold) rating = "Sell";
    
    return {
      mean: consensus.priceTarget,
      median: consensus.priceTarget, // API doesn't provide median separately
      high: consensus.highPriceTarget,
      low: consensus.lowPriceTarget,
      count: totalAnalysts,
      buy: buy,
      hold: hold,
      sell: sell,
      rating: rating
    };
  } catch (e) {
    console.log("Nasdaq API full data error for " + symbol + ": " + e.message);
    return null;
  }
}

// ============= FINVIZ (PRIMARY SOURCE) =============

/**
 * Get price target from FinViz
 * URL: https://finviz.com/quote.ashx?t={symbol}
 */
function getFinVizPriceTarget(symbol) {
  try {
    const data = getFinVizFullData(symbol);
    return data ? data.mean : null;
  } catch (e) {
    console.log("FinViz error for " + symbol + ": " + e.message);
    return null;
  }
}

/**
 * Get full analyst data from FinViz
 * Returns: { mean, median, high, low, count, recommendation }
 */
function getFinVizFullData(symbol) {
  try {
    const url = `https://finviz.com/quote.ashx?t=${symbol.toUpperCase()}`;
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    
    if (response.getResponseCode() !== 200) {
      console.log("FinViz returned status: " + response.getResponseCode());
      return null;
    }
    
    const html = response.getContentText();
    
    // FinViz shows Target Price in the snapshot table
    // Format: Target Price292.51
    const targetMatch = html.match(/Target Price<\/td><td[^>]*><b>([0-9,.]+)<\/b>/i);
    if (!targetMatch) {
      // Alternative pattern
      const altMatch = html.match(/Target Price[^0-9]*([0-9,.]+)/i);
      if (!altMatch) return null;
      
      const mean = parseFloat(altMatch[1].replace(/,/g, ''));
      if (isNaN(mean)) return null;
      
      return {
        mean: mean,
        median: mean,
        high: mean,
        low: mean,
        count: 1
      };
    }
    
    const mean = parseFloat(targetMatch[1].replace(/,/g, ''));
    if (isNaN(mean)) return null;
    
    // Try to get recommendation score (e.g., "Recom2.10")
    let recommendation = null;
    const recomMatch = html.match(/Recom[^0-9]*([0-9.]+)/i);
    if (recomMatch) {
      recommendation = parseFloat(recomMatch[1]);
    }
    
    return {
      mean: mean,
      median: mean, // FinViz only shows one target
      high: mean,
      low: mean,
      count: 1,
      recommendation: recommendation
    };
  } catch (e) {
    console.log("FinViz full data error for " + symbol + ": " + e.message);
    return null;
  }
}

// ============= MARKETWATCH (PRIMARY SOURCE) =============

/**
 * Get price target from MarketWatch (primary source)
 * URL: https://www.marketwatch.com/investing/stock/{symbol}/analystestimates
 */
function getMarketWatchPriceTarget(symbol) {
  try {
    const data = getMarketWatchFullData(symbol);
    return data ? data.mean : null;
  } catch (e) {
    console.log("MarketWatch error for " + symbol + ": " + e.message);
    return null;
  }
}

/**
 * Get full analyst data from MarketWatch
 * Returns: { mean, median, high, low, count }
 */
function getMarketWatchFullData(symbol) {
  try {
    const url = `https://www.marketwatch.com/investing/stock/${symbol.toLowerCase()}/analystestimates`;
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    
    if (response.getResponseCode() !== 200) {
      console.log("MarketWatch returned status: " + response.getResponseCode());
      return null;
    }
    
    const html = response.getContentText();
    const data = {};
    
    // Parse Average Target Price
    const avgMatch = html.match(/Average Target Price[^$]*\$([0-9,.]+)/i);
    if (avgMatch) {
      data.mean = parseFloat(avgMatch[1].replace(/,/g, ''));
    }
    
    // Parse High Target
    const highMatch = html.match(/High[^$]*\$([0-9,.]+)/i);
    if (highMatch) {
      data.high = parseFloat(highMatch[1].replace(/,/g, ''));
    }
    
    // Parse Median Target
    const medianMatch = html.match(/Median[^$]*\$([0-9,.]+)/i);
    if (medianMatch) {
      data.median = parseFloat(medianMatch[1].replace(/,/g, ''));
    }
    
    // Parse Low Target
    const lowMatch = html.match(/Low[^$]*\$([0-9,.]+)/i);
    if (lowMatch) {
      data.low = parseFloat(lowMatch[1].replace(/,/g, ''));
    }
    
    // Parse Number of Ratings
    const countMatch = html.match(/Number Of Ratings[^\d]*(\d+)/i);
    if (countMatch) {
      data.count = parseInt(countMatch[1]);
    }
    
    // Validate we got at least the mean
    if (data.mean && !isNaN(data.mean)) {
      return {
        mean: data.mean,
        median: data.median || data.mean,
        high: data.high || data.mean,
        low: data.low || data.mean,
        count: data.count || 1
      };
    }
    
    return null;
  } catch (e) {
    console.log("MarketWatch full data error for " + symbol + ": " + e.message);
    return null;
  }
}

// ============= YAHOO FINANCE FALLBACK =============

/**
 * Get price target from Yahoo Finance (fallback)
 * Uses main quote page which shows "1y Target Est"
 */
function getYahooPriceTarget(symbol) {
  try {
    const url = `https://finance.yahoo.com/quote/${symbol}`;
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    if (response.getResponseCode() !== 200) return null;
    
    const html = response.getContentText();
    
    // Yahoo shows "1y Target Est" followed by the price
    // Pattern: 1y Target Est</span>...</span>287.71</span>
    const targetRegex = /1y Target Est[^0-9]*([0-9,.]+)/i;
    const match = html.match(targetRegex);
    
    if (match && match[1]) {
      const target = parseFloat(match[1].replace(/[,$]/g, ''));
      if (!isNaN(target)) return target;
    }
    
    return null;
  } catch (e) {
    console.log("Yahoo Finance error for " + symbol + ": " + e.message);
    return null;
  }
}

/**
 * Get full price target data from Yahoo Finance (fallback)
 */
function getYahooFullData(symbol) {
  try {
    const url = `https://finance.yahoo.com/quote/${symbol}`;
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    if (response.getResponseCode() !== 200) return null;
    
    const html = response.getContentText();
    const data = {};
    
    // Look for 1y Target Est
    const targetMatch = html.match(/1y Target Est[^0-9]*([0-9,.]+)/i);
    if (targetMatch) {
      data.mean = parseFloat(targetMatch[1].replace(/[,$]/g, ''));
    }
    
    if (data.mean && !isNaN(data.mean)) {
      return {
        mean: data.mean,
        median: data.mean,
        high: data.mean,
        low: data.mean,
        count: 1
      };
    }
    
    return null;
  } catch (e) {
    console.log("Yahoo full data error: " + e.message);
    return null;
  }
}

function testPriceTarget() {
  console.log("Testing PRICE_TARGET:");
  console.log("AAPL:", PRICE_TARGET("AAPL"));
  console.log("MSFT:", PRICE_TARGET("MSFT"));
  console.log("NVDA:", PRICE_TARGET("NVDA"));
}

function testNasdaqAPI() {
  console.log("Testing Nasdaq API directly:");
  
  const symbols = ["AAPL", "MSFT", "NVDA", "GOOGL"];
  
  symbols.forEach(symbol => {
    console.log("\n--- " + symbol + " ---");
    const data = getNasdaqFullData(symbol);
    if (data) {
      console.log("Target Price: $" + data.mean);
      console.log("High: $" + data.high);
      console.log("Low: $" + data.low);
      console.log("Analysts: " + data.count + " (Buy: " + data.buy + ", Hold: " + data.hold + ", Sell: " + data.sell + ")");
      console.log("Rating: " + data.rating);
    } else {
      console.log("No data available");
    }
  });
}

function testFinViz() {
  console.log("Testing FinViz directly:");
  
  const symbols = ["AAPL", "MSFT", "NVDA", "GOOGL"];
  
  symbols.forEach(symbol => {
    console.log("\n--- " + symbol + " ---");
    const data = getFinVizFullData(symbol);
    if (data) {
      console.log("Target Price: $" + data.mean);
      if (data.recommendation) {
        console.log("Recommendation: " + data.recommendation);
      }
    } else {
      console.log("No data available");
    }
  });
}

function testMarketWatch() {
  console.log("Testing MarketWatch directly:");
  
  const symbols = ["COIN", "AAPL", "MSFT", "NVDA"];
  
  symbols.forEach(symbol => {
    console.log("\n--- " + symbol + " ---");
    const data = getMarketWatchFullData(symbol);
    if (data) {
      console.log("Mean: $" + data.mean);
      console.log("Median: $" + data.median);
      console.log("High: $" + data.high);
      console.log("Low: $" + data.low);
      console.log("Analyst Count: " + data.count);
    } else {
      console.log("No data available");
    }
  });
}

function testPriceTargetDetail() {
  console.log("Testing PRICE_TARGET_DETAIL:");
  const symbol = "AAPL";
  console.log(symbol + " Mean:", PRICE_TARGET_DETAIL(symbol, "mean"));
  console.log(symbol + " High:", PRICE_TARGET_DETAIL(symbol, "high"));
  console.log(symbol + " Low:", PRICE_TARGET_DETAIL(symbol, "low"));
  console.log(symbol + " Count:", PRICE_TARGET_DETAIL(symbol, "count"));
  console.log(symbol + " Buy:", PRICE_TARGET_DETAIL(symbol, "buy"));
  console.log(symbol + " Hold:", PRICE_TARGET_DETAIL(symbol, "hold"));
  console.log(symbol + " Sell:", PRICE_TARGET_DETAIL(symbol, "sell"));
  console.log(symbol + " Rating:", PRICE_TARGET_DETAIL(symbol, "rating"));
}

// ============= UNIT TESTS =============
// Run with: clasp run runAllTests
// Or run individual test functions from the Apps Script editor

/**
 * Test runner helper class
 */
class TestRunner {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }
  
  assert(testName, condition, actual, expected) {
    const result = {
      name: testName,
      passed: condition,
      actual: actual,
      expected: expected
    };
    this.tests.push(result);
    if (condition) {
      this.passed++;
      console.log("✓ PASS: " + testName);
    } else {
      this.failed++;
      console.log("✗ FAIL: " + testName + " - Expected: " + expected + ", Got: " + actual);
    }
    return condition;
  }
  
  assertEqual(testName, actual, expected) {
    return this.assert(testName, actual === expected, actual, expected);
  }
  
  assertNotEqual(testName, actual, notExpected) {
    return this.assert(testName, actual !== notExpected, actual, "not " + notExpected);
  }
  
  assertType(testName, value, expectedType) {
    return this.assert(testName, typeof value === expectedType, typeof value, expectedType);
  }
  
  assertInRange(testName, value, min, max) {
    const inRange = typeof value === "number" && value >= min && value <= max;
    return this.assert(testName, inRange, value, "between " + min + " and " + max);
  }
  
  getResults() {
    return {
      suite: this.suiteName,
      total: this.tests.length,
      passed: this.passed,
      failed: this.failed,
      tests: this.tests,
      success: this.failed === 0
    };
  }
  
  printSummary() {
    console.log("\n" + "=".repeat(50));
    console.log("TEST SUMMARY: " + this.suiteName);
    console.log("=".repeat(50));
    console.log("Total: " + this.tests.length);
    console.log("Passed: " + this.passed);
    console.log("Failed: " + this.failed);
    console.log("=".repeat(50));
    
    if (this.failed > 0) {
      console.log("\nFAILED TESTS:");
      this.tests.filter(t => !t.passed).forEach(t => {
        console.log("  - " + t.name);
        console.log("    Expected: " + t.expected);
        console.log("    Actual: " + t.actual);
      });
    }
  }
}

/**
 * Run all tests - main entry point for clasp run
 * @returns {Object} Test results with success status
 */
function runAllTests() {
  console.log("=".repeat(50));
  console.log("RUNNING ALL TESTS");
  console.log("=".repeat(50));
  
  const allResults = [];
  
  // Run quick PRICE_TARGET test (optimized for speed)
  try {
    allResults.push(testPriceTargetCOIN());
  } catch (e) {
    console.log("Error in testPriceTargetCOIN: " + e.message);
    allResults.push({ suite: "PRICE_TARGET_COIN", success: false, failed: 1, passed: 0, error: e.message });
  }
  
  // Calculate totals
  const totalPassed = allResults.reduce((sum, r) => sum + (r.passed || 0), 0);
  const totalFailed = allResults.reduce((sum, r) => sum + (r.failed || 0), 0);
  const totalTests = totalPassed + totalFailed;
  const allPassed = totalFailed === 0 && allResults.every(r => r.success !== false);
  
  console.log("\n" + "=".repeat(50));
  console.log("FINAL RESULTS");
  console.log("=".repeat(50));
  console.log("Total Tests: " + totalTests);
  console.log("Passed: " + totalPassed);
  console.log("Failed: " + totalFailed);
  console.log("Status: " + (allPassed ? "✓ ALL TESTS PASSED" : "✗ SOME TESTS FAILED"));
  console.log("=".repeat(50));
  
  // Return results object
  const finalResults = {
    success: allPassed,
    totalTests: totalTests,
    passed: totalPassed,
    failed: totalFailed,
    suites: allResults
  };
  
  if (!allPassed) {
    throw new Error("TESTS FAILED: " + totalFailed + " of " + totalTests + " tests failed");
  }
  
  return finalResults;
}

/**
 * Unit test for PRICE_TARGET("COIN") - OPTIMIZED VERSION
 * Tests that the function returns a valid numeric price target
 * Run this function from the Apps Script editor or via clasp run testPriceTargetCOIN
 */
function testPriceTargetCOIN() {
  const runner = new TestRunner("PRICE_TARGET_COIN");
  
  console.log("=".repeat(50));
  console.log("UNIT TEST: PRICE_TARGET('COIN')");
  console.log("=".repeat(50));
  
  // Test 1: Call PRICE_TARGET once and reuse result (uses cache for subsequent calls)
  const result = PRICE_TARGET("COIN");
  
  runner.assert(
    "PRICE_TARGET returns a value",
    result !== undefined && result !== null,
    result,
    "not undefined/null"
  );
  
  // Test 2: Result is not "N/A"
  runner.assertNotEqual("Result is not N/A", result, "N/A");
  
  // Test 3: Result is a number
  runner.assertType("Result is a valid number", result, "number");
  
  // Test 4: Price target is within reasonable range for COIN (Coinbase)
  runner.assertInRange("Price target in reasonable range ($50-$1000)", result, 50, 1000);
  
  // Test 5 & 6: These use cache so they're fast
  const resultLower = PRICE_TARGET("coin");
  runner.assertType("Case insensitive - lowercase works", resultLower, "number");
  
  const resultWhitespace = PRICE_TARGET("  COIN  ");
  runner.assertType("Handles whitespace correctly", resultWhitespace, "number");
  
  // Print summary
  runner.printSummary();
  
  const results = runner.getResults();
  
  if (!results.success) {
    throw new Error("TEST FAILED: " + results.failed + " of " + results.total + " tests failed");
  }
  
  console.log("\n✓ ALL TESTS PASSED!");
  return results;
}

/**
 * Quick test - minimal test for CI/CD (fastest)
 * Only tests that PRICE_TARGET returns a valid number
 */
function testPriceTargetQuick() {
  console.log("Quick test: PRICE_TARGET('COIN')");
  
  const result = PRICE_TARGET("COIN");
  
  if (result === "N/A" || result === "No symbol") {
    throw new Error("FAIL: PRICE_TARGET returned: " + result);
  }
  
  if (typeof result !== "number" || isNaN(result)) {
    throw new Error("FAIL: PRICE_TARGET did not return a number: " + typeof result + " = " + result);
  }
  
  if (result < 50 || result > 1000) {
    throw new Error("FAIL: Price target out of range: $" + result);
  }
  
  console.log("✓ PASS: PRICE_TARGET('COIN') = $" + result);
  return { success: true, result: result };
}

/**
 * Test Nasdaq API directly (fastest data source)
 */
function testNasdaqDirect() {
  console.log("Testing Nasdaq API directly for COIN...");
  
  const data = getNasdaqFullData("COIN");
  
  if (!data) {
    throw new Error("FAIL: Nasdaq API returned no data");
  }
  
  if (typeof data.mean !== "number") {
    throw new Error("FAIL: Nasdaq mean is not a number: " + data.mean);
  }
  
  console.log("✓ PASS: Nasdaq API");
  console.log("  Mean: $" + data.mean);
  console.log("  High: $" + data.high);
  console.log("  Low: $" + data.low);
  console.log("  Analysts: " + data.count + " (Buy: " + data.buy + ", Hold: " + data.hold + ", Sell: " + data.sell + ")");
  
  return { success: true, data: data };
}


