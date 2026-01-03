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
  const cacheKey = "TipRanks_" + symbol;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    const value = parseFloat(cached);
    return isNaN(value) ? cached : value;
  }
  
  let result = null;
  
  // Try Nasdaq API first (most reliable, JSON API)
  result = getNasdaqPriceTarget(symbol);
  
  // Fallback to FinViz
  if (!result) {
    result = getFinVizPriceTarget(symbol);
  }
  
  // Fallback to MarketWatch
  if (!result) {
    result = getMarketWatchPriceTarget(symbol);
  }
  
  // Last resort: Yahoo Finance (main quote page)
  if (!result) {
    result = getYahooPriceTarget(symbol);
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
    // Try Nasdaq API first (most reliable, JSON API)
    data = getNasdaqFullData(symbol);
    
    // Fallback to FinViz
    if (!data) {
      data = getFinVizFullData(symbol);
    }
    
    // Fallback to MarketWatch
    if (!data) {
      data = getMarketWatchFullData(symbol);
    }
    
    // Last resort: Yahoo Finance
    if (!data) {
      data = getYahooFullData(symbol);
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
