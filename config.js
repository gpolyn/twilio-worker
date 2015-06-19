// Papertrail = add to here

module.exports = {

  // application paths
  app_url: process.env.APP_URL || "all-in-one.ngrok.com",


  // Services
  mongo_url: process.env.MONGODB || 'mongodb://localhost:27017/appDev',
  rabbit_url: process.env.AMQP_URL || 'amqp://localhost',
  port: int(process.env.PORT) || 5000,

  // Security
  cookie_secret: process.env.COOKIE_SECRET || 'myCookieSecret',
  twilio: {
    account_sid: process.env.TWILIO_ACCOUNT_SID,
    auth_token:  process.env.TWILIO_AUTH_TOKEN
  },
  aws: {
    aws_key: process.env.AWS_KEY_ID,
    aws_secret: process.env.AWS_SECRET_ACCESS_KEY,
    s3: {
      bucket: process.env.S3_BUCKET,
      bucket_region: process.env.S3_BUCKET_REGION,
    }
  },

  postmark: {
    token: process.env.POSTMARK_API_TOKEN 
  },

  // App behavior
  verbose: bool(process.env.VERBOSE) || false,                    // Log 200s?
  concurrency: int(process.env.CONCURRENCY) || 1,                 // Number of Cluster processes to fork in Server
  worker_concurrency: int(process.env.WORKER_CONCURRENCY) || 1,   // Number of Cluster processes to fork in Worker
  thrifty: bool(process.env.THRIFTY) || false,                    // Web process also executes job queue?
  view_cache: bool(process.env.VIEW_CACHE) || true,               // Cache rendered views?
  mongo_cache: int(process.env.MONGO_CACHE) || 10000,             // LRU cache for mongo queries

  // Benchmarking
  benchmark: bool(process.env.BENCHMARK) || false,                // Enable benchmark route?
  benchmark_add: float(process.env.BENCHMARK_ADD) || 0.02,        // Likelihood of benchmarking a new article
  benchmark_vote: float(process.env.BENCHMARK_VOTE) || 0.12       // Likelihood of benchmarking an upvote
};

function bool(str) {
  if (str == void 0) return false;
  return str.toLowerCase() === 'true';
}

function int(str) {
  if (!str) return 0;
  return parseInt(str, 10);
}

function float(str) {
  if (!str) return 0;
  return parseFloat(str, 10);
}
