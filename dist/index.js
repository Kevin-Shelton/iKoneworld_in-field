// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var languages = mysqlTable("languages", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  // e.g., "en-US", "es-MX"
  baseCode: varchar("baseCode", { length: 8 }).notNull(),
  // e.g., "en", "es"
  name: varchar("name", { length: 255 }).notNull(),
  // e.g., "English (United States)"
  nativeName: varchar("nativeName", { length: 255 }),
  // e.g., "English"
  direction: mysqlEnum("direction", ["ltr", "rtl"]).default("ltr").notNull(),
  countryCode: varchar("countryCode", { length: 8 }),
  // e.g., "US", "MX"
  isFavorite: boolean("isFavorite").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var sttLanguages = mysqlTable("stt_languages", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  // Full language code (e.g., "en-US")
  lang: varchar("lang", { length: 8 }).notNull(),
  // Base language (e.g., "en")
  origin: varchar("origin", { length: 255 }),
  // Origin/country (e.g., "United States")
  displayLang: varchar("displayLang", { length: 255 }),
  // Display language name
  displayOrigin: varchar("displayOrigin", { length: 255 }),
  // Display origin name
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var ttsVoices = mysqlTable("tts_voices", {
  id: int("id").autoincrement().primaryKey(),
  language: varchar("language", { length: 16 }).notNull(),
  // Language code (e.g., "en-US")
  voice: varchar("voice", { length: 255 }).notNull(),
  // Voice identifier (e.g., "en-US-JennyNeural") - not unique as voices can be reused across languages
  gender: mysqlEnum("gender", ["male", "female", "neutral"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var tttLanguages = mysqlTable("ttt_languages", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  // Language code (e.g., "en", "es")
  name: varchar("name", { length: 255 }).notNull(),
  // Language name
  nativeName: varchar("nativeName", { length: 255 }),
  // Native language name
  direction: mysqlEnum("direction", ["ltr", "rtl"]).default("ltr").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to users table
  language1: varchar("language1", { length: 16 }).notNull(),
  // Primary language (e.g., "en-US")
  language2: varchar("language2", { length: 16 }).notNull(),
  // Secondary language (e.g., "es-MX")
  status: mysqlEnum("status", ["active", "completed", "failed"]).default("active").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var conversationMessages = mysqlTable("conversation_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  // Foreign key to conversations table
  speaker: mysqlEnum("speaker", ["user", "guest"]).notNull(),
  // Who spoke (user or guest)
  originalText: text("originalText").notNull(),
  // Original recognized text
  translatedText: text("translatedText").notNull(),
  // Translated text
  language: varchar("language", { length: 16 }).notNull(),
  // Language of original text
  confidence: int("confidence").notNull(),
  // Confidence score (0-100, stored as integer percentage)
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // iK OneWorld custom environment variables
  verbumApiKey: process.env.VERBUM_API_KEY ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getAllLanguages() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get languages: database not available");
    return [];
  }
  return await db.select().from(languages);
}
async function getFavoriteLanguages() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get favorite languages: database not available");
    return [];
  }
  return await db.select().from(languages).where(eq(languages.isFavorite, true));
}
async function getAllSttLanguages() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get STT languages: database not available");
    return [];
  }
  return await db.select().from(sttLanguages);
}
async function getAllTtsVoices() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get TTS voices: database not available");
    return [];
  }
  return await db.select().from(ttsVoices);
}
async function getTtsVoicesByLanguage(languageCode) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get TTS voices: database not available");
    return [];
  }
  return await db.select().from(ttsVoices).where(eq(ttsVoices.language, languageCode));
}
async function getAllTttLanguages() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get TTT languages: database not available");
    return [];
  }
  return await db.select().from(tttLanguages);
}
async function createConversation(data) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.insert(conversations).values(data);
  return result[0].insertId;
}
async function getConversationsByUserId(userId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get conversations: database not available");
    return [];
  }
  return await db.select().from(conversations).where(eq(conversations.userId, userId));
}
async function getConversationById(conversationId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get conversation: database not available");
    return void 0;
  }
  const result = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateConversationStatus(conversationId, status, endedAt) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const updateData = { status };
  if (endedAt) {
    updateData.endedAt = endedAt;
  }
  await db.update(conversations).set(updateData).where(eq(conversations.id, conversationId));
}
async function createConversationMessage(data) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.insert(conversationMessages).values(data);
  return result[0].insertId;
}
async function getConversationMessages(conversationId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get conversation messages: database not available");
    return [];
  }
  return await db.select().from(conversationMessages).where(eq(conversationMessages.conversationId, conversationId));
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z2 } from "zod";
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  // Conversation endpoints
  conversations: router({
    // Create a new conversation
    create: protectedProcedure.input(z2.object({
      language1: z2.string(),
      language2: z2.string()
    })).mutation(async ({ ctx, input }) => {
      const conversationId = await createConversation({
        userId: ctx.user.id,
        language1: input.language1,
        language2: input.language2,
        status: "active"
      });
      return { conversationId };
    }),
    // Get all conversations for the current user
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await getConversationsByUserId(ctx.user.id);
    }),
    // Get a specific conversation by ID
    getById: protectedProcedure.input(z2.object({ conversationId: z2.number() })).query(async ({ ctx, input }) => {
      const conversation = await getConversationById(input.conversationId);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new Error("Conversation not found or access denied");
      }
      return conversation;
    }),
    // Update conversation status
    updateStatus: protectedProcedure.input(z2.object({
      conversationId: z2.number(),
      status: z2.enum(["active", "completed", "failed"]),
      endedAt: z2.date().optional()
    })).mutation(async ({ ctx, input }) => {
      const conversation = await getConversationById(input.conversationId);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new Error("Conversation not found or access denied");
      }
      await updateConversationStatus(input.conversationId, input.status, input.endedAt);
      return { success: true };
    }),
    // Create a new message in a conversation
    createMessage: protectedProcedure.input(z2.object({
      conversationId: z2.number(),
      speaker: z2.enum(["user", "guest"]),
      originalText: z2.string(),
      translatedText: z2.string(),
      language: z2.string(),
      confidence: z2.number().min(0).max(100)
    })).mutation(async ({ ctx, input }) => {
      const conversation = await getConversationById(input.conversationId);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new Error("Conversation not found or access denied");
      }
      const messageId = await createConversationMessage(input);
      return { messageId };
    }),
    // Get all messages for a conversation
    getMessages: protectedProcedure.input(z2.object({ conversationId: z2.number() })).query(async ({ ctx, input }) => {
      const conversation = await getConversationById(input.conversationId);
      if (!conversation || conversation.userId !== ctx.user.id) {
        throw new Error("Conversation not found or access denied");
      }
      return await getConversationMessages(input.conversationId);
    })
  }),
  // Language data endpoints
  languages: router({
    // Get all languages
    getAll: publicProcedure.query(async () => {
      return await getAllLanguages();
    }),
    // Get favorite languages
    getFavorites: publicProcedure.query(async () => {
      return await getFavoriteLanguages();
    }),
    // Get all STT languages
    getSttLanguages: publicProcedure.query(async () => {
      return await getAllSttLanguages();
    }),
    // Get all TTS voices
    getTtsVoices: publicProcedure.query(async () => {
      return await getAllTtsVoices();
    }),
    // Get TTS voices for a specific language
    getTtsVoicesByLanguage: publicProcedure.input(z2.object({ languageCode: z2.string() })).query(async ({ input }) => {
      return await getTtsVoicesByLanguage(input.languageCode);
    }),
    // Get all TTT languages
    getTttLanguages: publicProcedure.query(async () => {
      return await getAllTttLanguages();
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/api/translate.ts
async function translateHandler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { texts, from, to } = req.body;
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    res.status(400).json({ error: "Invalid request: texts array is required" });
    return;
  }
  if (!from || typeof from !== "string") {
    res.status(400).json({ error: "Invalid request: from language is required" });
    return;
  }
  if (!to || !Array.isArray(to) || to.length === 0) {
    res.status(400).json({ error: "Invalid request: to languages array is required" });
    return;
  }
  if (!ENV.verbumApiKey) {
    res.status(500).json({ error: "Translation service not configured" });
    return;
  }
  try {
    const response = await fetch("https://sdk.verbum.ai/v1/translator/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ENV.verbumApiKey}`
      },
      body: JSON.stringify({
        texts,
        from,
        to
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Translation API error:", response.status, errorText);
      res.status(response.status).json({
        error: "Translation service error",
        details: errorText
      });
      return;
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({
      error: "Failed to translate",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// server/api/synthesize.ts
async function synthesizeHandler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { voice, text: text2, audioFormat = "Audio16Khz128KBitMp3", model = "default" } = req.body;
  if (!voice || typeof voice !== "string") {
    res.status(400).json({ error: "Invalid request: voice is required" });
    return;
  }
  if (!text2 || typeof text2 !== "string") {
    res.status(400).json({ error: "Invalid request: text is required" });
    return;
  }
  if (!ENV.verbumApiKey) {
    res.status(500).json({ error: "TTS service not configured" });
    return;
  }
  try {
    const response = await fetch("https://sdk.verbum.ai/v1/speech/synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ENV.verbumApiKey}`
      },
      body: JSON.stringify({
        voice,
        text: text2,
        audioFormat,
        model
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("TTS API error:", response.status, errorText);
      res.status(response.status).json({
        error: "TTS service error",
        details: errorText
      });
      return;
    }
    const audioBuffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.byteLength.toString());
    res.status(200).send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error("TTS error:", error);
    res.status(500).json({
      error: "Failed to synthesize speech",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.post("/api/translate", translateHandler);
  app.post("/api/synthesize", synthesizeHandler);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
