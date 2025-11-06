/**
 * Sentiment Analysis Helper
 * Analyzes text sentiment using Verbum AI API
 */

export interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  confidenceScores: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

/**
 * Analyze sentiment of a text
 * @param text The text to analyze
 * @param language The language code (e.g., "en-US", "es-MX")
 * @returns Sentiment result or null if analysis fails
 */
export async function analyzeSentiment(
  text: string,
  language: string
): Promise<SentimentResult | null> {
  try {
    const response = await fetch('/api/sentiment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [text],
        language: language
      })
    });

    if (!response.ok) {
      console.error('[Sentiment] API error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data && Array.isArray(data) && data[0]) {
      return {
        sentiment: data[0].sentiment,
        confidenceScores: data[0].confidenceScores
      };
    }
    
    return null;
  } catch (err) {
    console.error('[Sentiment] Error:', err);
    return null;
  }
}

/**
 * Get sentiment icon based on sentiment type
 * @param sentiment The sentiment type
 * @returns Emoji icon representing the sentiment
 */
export function getSentimentIcon(sentiment: "positive" | "negative" | "neutral" | "mixed" | undefined): string {
  switch (sentiment) {
    case "positive":
      return "😊"; // Happy face
    case "negative":
      return "😟"; // Worried face
    case "mixed":
      return "😐"; // Neutral face (mixed emotions)
    case "neutral":
      return "😶"; // Face without mouth (neutral)
    default:
      return "";
  }
}

/**
 * Get sentiment color for UI styling
 * @param sentiment The sentiment type
 * @returns Tailwind color class
 */
export function getSentimentColor(sentiment: "positive" | "negative" | "neutral" | "mixed" | undefined): string {
  switch (sentiment) {
    case "positive":
      return "text-green-600 dark:text-green-400";
    case "negative":
      return "text-red-600 dark:text-red-400";
    case "mixed":
      return "text-yellow-600 dark:text-yellow-400";
    case "neutral":
      return "text-gray-600 dark:text-gray-400";
    default:
      return "text-gray-400";
  }
}
