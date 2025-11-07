/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  onRetry: () => {},
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  return Math.min(delay, options.maxDelay);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any, options: Required<RetryOptions>): boolean {
  // Network errors are always retryable
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }
  
  // Check HTTP status codes
  if (error.status && options.retryableStatuses.includes(error.status)) {
    return true;
  }
  
  // Check if response has retryable status
  if (error.response?.status && options.retryableStatuses.includes(error.response.status)) {
    return true;
  }
  
  return false;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // If this is the last attempt or error is not retryable, throw
      if (attempt === opts.maxAttempts || !isRetryableError(error, opts)) {
        throw error;
      }
      
      // Calculate delay and notify
      const delay = calculateDelay(attempt, opts);
      opts.onRetry(attempt, lastError);
      
      console.log(`[Retry] Attempt ${attempt}/${opts.maxAttempts} failed. Retrying in ${delay}ms...`);
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Retry a fetch request with exponential backoff
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return retryWithBackoff(async () => {
    const response = await fetch(url, init);
    
    // If response is not ok and status is retryable, throw to trigger retry
    if (!response.ok && (options.retryableStatuses || DEFAULT_OPTIONS.retryableStatuses).includes(response.status)) {
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    
    return response;
  }, options);
}
