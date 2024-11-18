// Listen on a specific host via the HOST environment variable
process.env.PORT = process.env.PORT || '8080';
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.CORSANYWHERE_WHITELIST = process.env.CORSANYWHERE_WHITELIST || 'https://gogoanime.me.uk,http://gogoanime.me.uk,http://gogoanime.me.uk:8080,https://kbergetar.us,http://kbergetar.us,http://kbergetar.us:8080';
process.env.CORSANYWHERE_BLACKLIST = process.env.CORSANYWHERE_BLACKLIST || '';

var host = process.env.HOST;
var port = process.env.PORT;

// Grab the blacklist from the command-line so that we can update the blacklist without deploying
// again. CORS Anywhere is open by design, and this blacklist is not used, except for countering
// immediate abuse (e.g. denial of service). If you want to block all origins except for some,
// use originWhitelist instead.
var originBlacklist = parseEnvList(process.env.CORSANYWHERE_BLACKLIST);
var originWhitelist = parseEnvList(process.env.CORSANYWHERE_WHITELIST);
function parseEnvList(env) {
  if (!env) {
    return [];
  }
  return env.split(',');
}
const NodeCache = require("node-cache");
const requestCache = new NodeCache({ stdTTL: 300, checkperiod: 320 }); // Cache for 5 minutes

// Set up rate-limiting to avoid abuse of the public CORS Anywhere server.
// var checkRateLimit = require('./lib/rate-limit')(process.env.CORSANYWHERE_RATELIMIT);

var cors_proxy = require('./lib/cors-anywhere');
cors_proxy.createServer({
  originBlacklist: originBlacklist,
  originWhitelist: originWhitelist,
  requireHeader: ['origin', 'x-requested-with'],
  // checkRateLimit: checkRateLimit,
  removeHeaders: [
    'cookie',
    'cookie2',
    // Strip Heroku-specific headers
    'x-request-start',
    'x-request-id',
    'via',
    'connect-time',
    'total-route-time',
    // Other Heroku added debug headers
    // 'x-forwarded-for',
    // 'x-forwarded-proto',
    // 'x-forwarded-port',
  ],
  redirectSameOrigin: true,
  httpProxyOptions: {
    // Do not add X-Forwarded-For, etc. headers, because Heroku already adds it.
    xfwd: false,
  },
  interceptResponse: function(req, res, proxyRes) {
    const urlKey = `${req.method}:${req.url}`;

    // Check if the request is cached
    if (requestCache.has(urlKey)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(requestCache.get(urlKey));
      return true; // Skip proxying
    }

    let body = '';
    proxyRes.on('data', chunk => (body += chunk));
    proxyRes.on('end', () => {
      try {
        // Store the response in cache
        requestCache.set(urlKey, body);
        res.end(body);
      } catch (err) {
        console.error("Error caching response:", err);
        res.end(body);
      }
    });
    return false; // Continue with proxy
  },
}).listen(port, host, function() {
  console.log('Running CORS Anywhere on ' + host + ':' + port);
});
