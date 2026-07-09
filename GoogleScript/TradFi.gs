function quoteYahoo(ticker) {
  const url = `https://finance.yahoo.com/quote/${ticker}`;
  
  try {
    // Fetch the HTML content of the Yahoo Finance page for the given ticker
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const html = response.getContentText();
    
    // Use a regex to dynamically match the 'data-symbol' and extract the 'data-value' for the ticker
    const priceRegex = new RegExp(`<fin-streamer[^>]*data-symbol="${ticker}"[^>]*data-value="([\\d.]+)"`);
    const match = html.match(priceRegex);
    
    if (match && match[1]) {
      return parseFloat(match[1]); // Return the extracted price as a number
    } else {
      return `${ticker} price is not found`;
    }
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

function quoteFinviz(ticker) {
  try {
    // Fetch the HTML content of the Finviz page for the given ticker
    const url = `https://finviz.com/quote.ashx?t=${ticker}&p=d`;
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });

    // Get the content as text
    const html = response.getContentText();

    // Extract the price from the <strong class="quote-price_wrapper_price"> tag
    const regex = /<strong class="quote-price_wrapper_price">([\d.]+)<\/strong>/;
    const match = html.match(regex);

    if (match && match[1]) {
      // Return the extracted price
      return parseFloat(match[1]);
    } else {
      throw new Error('Price not found on the page. The structure might have changed.');
    }
  } catch (error) {
    // Log and return the error message
    console.error(`Error fetching price for ${ticker}: ${error.message}`);
    return `Error: ${error.message}`;
  }
}

