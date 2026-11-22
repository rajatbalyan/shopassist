/** Gemini model used for every AI route. Change it here (or with GEMINI_MODEL). */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export const config = {
  port: Number(process.env.PORT) || 8080,
  projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '',
  /** Vertex AI location for Gemini. Cloud Run and Firestore run in asia-south1. */
  location: process.env.GCP_LOCATION || 'us-central1',
  model: GEMINI_MODEL,
  adminKey: process.env.ADMIN_KEY || '',
  store: (process.env.STORE === 'memory' ? 'memory' : 'firestore') as 'memory' | 'firestore',
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
};

export const AI = {
  temperature: 0.2,
  timeoutMs: 15_000,
  retries: 1,
  maxQuestionLength: 500,
  maxHistoryTurns: 6,
  rateLimitPerMinute: 20,
};

export const NOT_GROUNDED_ANSWER = "That isn't in the product details or reviews.";
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

// Same rule as the app (src/lib/pricing.ts): free delivery from ₹499, else ₹49.
export const FREE_DELIVERY_THRESHOLD = 499;
export const DELIVERY_FEE = 49;
export const MAX_QTY = 10;
