# Mero - Security & Deployment Plan

**Created:** November 14, 2025  
**Purpose:** Comprehensive guide for securing Mero and deploying to production with authentication, payments, and proper architecture.

---

## 🚨 CRITICAL SECURITY ISSUE - ACTION REQUIRED

### **Immediate Action: Regenerate API Keys**

Your API keys are currently exposed in `.env.local`:
- Gemini API Key: `<REDACTED>`
- Fal.ai API Key: `<REDACTED>`

**❌ REGENERATE THESE IMMEDIATELY:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey) → Regenerate Gemini API key
2. Go to [Fal.ai Dashboard](https://fal.ai/dashboard/keys) → Regenerate your API key
3. Update `.env.local` with new keys
4. **NEVER commit `.env.local` to git** (already in `.gitignore` ✅)

---

## 🎯 Recommended Solution: Use Your Agentic Coding Starter Kit

**Location:** `C:\Users\taylo\_New_Projects_Nov_12\agentic-coding-starter-kit`

### Why This Starter Kit is Perfect for Mero

Your starter kit already includes everything Mero needs:

#### ✅ **Authentication System**
- **Better Auth** - Modern, secure authentication library
- **Google OAuth** - Social login ready to use
- Session management with PostgreSQL
- User/session/account tables pre-configured
- Type-safe auth client and server setup

#### ✅ **Database Infrastructure**
- **Drizzle ORM** - Type-safe database operations
- **PostgreSQL** - Production-ready, scalable database
- Migration system with `pnpm db:migrate`
- Schema already includes users, sessions, accounts, verification

#### ✅ **Payment Processing (Polar.sh)**
- **Polar.sh** - Developer-first payment platform (better than Stripe for SaaS!)
- Automatic customer creation on user signup
- Built-in checkout integration
- Customer portal for subscription management
- Usage-based billing support (perfect for AI credits!)
- Webhook handling with signature verification
- Lower fees: 4.1% vs Stripe's 2.9% + $0.30

#### ✅ **Modern Tech Stack**
- **Next.js 15** - Latest with App Router
- **React 19** - Cutting edge
- **TypeScript** - Full type safety
- **Tailwind CSS 4** - Modern styling
- **shadcn/ui** - Beautiful, accessible components
- **pnpm** - Fast, efficient package manager

#### ✅ **AI Integration Ready**
- **OpenRouter** - Access to multiple AI models
- **Vercel AI SDK** - Streaming chat responses
- Pre-configured chat interface

#### ✅ **Railway Deployment Ready**
- Build script with auto-migrations
- Environment variables configured
- PostgreSQL connection ready
- One-command deployment

---

## 📋 Integration Strategy: Migrate Mero INTO Starter Kit

### Option A: Fresh Start with Starter (RECOMMENDED)

**Why?** Start with battle-tested security foundation, add Mero's canvas features.

**Pros:**
- ✅ Security built-in from day one
- ✅ Authentication working immediately
- ✅ Payments configured and ready
- ✅ API keys stay server-side (never exposed)
- ✅ Railway deployment is trivial
- ✅ Type-safe database operations
- ✅ Less technical debt

**Cons:**
- ⚠️ Need to port Mero components (1-2 days work)
- ⚠️ Convert from Vite to Next.js structure

### Option B: Add Starter Features to Mero

**Why?** Keep Mero structure, add auth/DB/payments.

**Pros:**
- ✅ Keep existing Vite setup
- ✅ Less file moving

**Cons:**
- ❌ Need to convert from Vite to Next.js anyway (for API routes)
- ❌ More manual configuration
- ❌ Higher chance of mistakes
- ❌ More work overall

**Recommendation:** **Use Option A** - cleaner, faster, more secure from day one.

---

## 🏗️ Architecture After Integration

```
┌─────────────────────────────────────────────────────────┐
│           Mero Canvas (Next.js 15 Frontend)             │
│  - Infinite canvas UI (your existing components)        │
│  - Voice commands system                                │
│  - Board rendering and interactions                     │
│  - Protected routes (requires authentication)           │
│  - No API keys in client code                           │
└──────────────────────┬──────────────────────────────────┘
                       │ (Authenticated HTTPS requests)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes (Server)                │
│  ┌───────────────────────────────────────────────────┐  │
│  │ /api/auth/*          (Better Auth endpoints)      │  │
│  │ /api/boards/*        (CRUD for boards)            │  │
│  │ /api/boards/[id]     (Get/update/delete board)    │  │
│  │ /api/items/*         (CRUD for board items)       │  │
│  │ /api/ai/gemini       (Proxy to Gemini API)        │  │
│  │ /api/ai/falai        (Proxy to Fal.ai API)        │  │
│  │ /api/ai/voice        (Speech-to-text handling)    │  │
│  │ /polar/webhooks      (Payment webhook handling)   │  │
│  └───────────────────────────────────────────────────┘  │
│  - Rate limiting on all endpoints                       │
│  - Input validation and sanitization                    │
│  - API keys stored in server environment only           │
│  - User authentication checks                           │
└────────┬──────────────────┬─────────────────────────────┘
         │                  │
         ▼                  ▼
┌──────────────────┐  ┌─────────────────────────┐
│   PostgreSQL     │  │     AI Services         │
│   (Railway)      │  │                         │
│                  │  │  - Google Gemini API    │
│  Tables:         │  │  - Fal.ai (images/video)│
│  - users         │  │                         │
│  - sessions      │  │  API keys stored        │
│  - accounts      │  │  server-side ONLY!      │
│  - boards        │  │  Never exposed to       │
│  - board_items   │  │  frontend               │
│  - subscriptions │  └─────────────────────────┘
│  - ai_usage      │
└──────────────────┘
         ▲
         │
         ▼
┌──────────────────┐
│    Polar.sh      │
│  (Payments)      │
│                  │
│  - Checkouts     │
│  - Subscriptions │
│  - Customer      │
│    Portal        │
│  - Webhooks      │
└──────────────────┘
```

---

## 🔒 Security Checklist for Production

### 🔴 **CRITICAL (Must Do Before Launch)**

#### 1. Backend API for AI Services
- ❌ **NEVER expose API keys in frontend code**
- ✅ Move ALL Gemini & Fal.ai calls to Next.js API routes
- ✅ Frontend → Your Backend API → AI Services
- ✅ Validate user authentication before processing requests
- ✅ Rate limit AI endpoints (prevent abuse)

**Example API Route Structure:**
```typescript
// src/app/api/ai/gemini/route.ts
export async function POST(req: Request) {
  // 1. Check authentication
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  
  // 2. Rate limit check (e.g., 100 requests/hour)
  const rateLimitOk = await checkRateLimit(session.user.id);
  if (!rateLimitOk) return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  
  // 3. Use API key from server environment
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // 4. Process request and return
  const result = await gemini.generateText(...);
  return Response.json(result);
}
```

#### 2. Authentication System
- ✅ Add user login (Better Auth with Google OAuth)
- ✅ Require authentication to access canvas
- ✅ Each user gets isolated boards/data (row-level security)
- ✅ Session tokens in httpOnly cookies (not localStorage)
- ✅ CSRF protection built-in with Better Auth

#### 3. Environment Variables
- ✅ Keep ALL API keys in server-side `.env` only
- ✅ Never expose in `import.meta.env` or client-side code
- ✅ Use `.env.example` as template (no real keys)
- ✅ Add `.env` to `.gitignore` (already done ✅)

#### 4. HTTPS/SSL
- ✅ Deploy with HTTPS only (Railway/Vercel auto-provides)
- ✅ Set `Strict-Transport-Security` header
- ✅ Redirect HTTP to HTTPS

#### 5. Content Security Policy (CSP)
```typescript
// next.config.ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  }
];
```

### 🟡 **HIGH PRIORITY (Do Before Public Launch)**

#### 6. Input Sanitization
- ✅ Already using DOMPurify (good!)
- ✅ Sanitize ALL user inputs before database storage
- ✅ Validate file uploads (type, size, content)
- ✅ Validate JSON payloads in API routes

#### 7. Rate Limiting
- ✅ Backend: Limit AI API calls per user (e.g., 100/hour for free, 500/hour for pro)
- ✅ Limit file uploads (images/videos) per day
- ✅ Protect expensive operations (AI image gen, video gen)
- ✅ Track usage in database for billing

**Implementation:**
```typescript
// lib/rate-limit.ts
import { db } from './db';

export async function checkRateLimit(userId: string, action: string, limit: number) {
  const usage = await db.query.usageLog.findFirst({
    where: (log, { eq, and, gt }) => and(
      eq(log.userId, userId),
      eq(log.action, action),
      gt(log.timestamp, new Date(Date.now() - 3600000)) // Last hour
    )
  });
  
  return (usage?.count || 0) < limit;
}
```

#### 8. File Upload Security
- ✅ Validate file types (only allow images, videos)
- ✅ Set max file size (e.g., 10MB images, 100MB videos)
- ✅ Generate unique filenames (prevent overwrites)
- ✅ Store uploads in S3/Cloudflare R2/Vercel Blob
- ✅ Scan for malware (optional: VirusTotal API)
- ⚠️ Currently: Files stored in IndexedDB (client-side, not secure)

#### 9. Database Security
- ✅ Move from client-side IndexedDB to PostgreSQL
- ✅ Implement row-level security (users can only access their boards)
- ✅ Encrypt sensitive data at rest
- ✅ Use parameterized queries (Drizzle does this ✅)
- ✅ Regular database backups (Railway auto-backups)

#### 10. Session Management
- ✅ Use httpOnly cookies (Better Auth does this ✅)
- ✅ Implement session expiration (30 days default)
- ✅ Add CSRF tokens (Better Auth includes)
- ✅ Logout invalidates session properly

### 🟢 **IMPORTANT (Do Within First Month)**

#### 11. API Endpoint Protection
```typescript
// Middleware to check board ownership
async function verifyBoardOwnership(userId: string, boardId: string) {
  const board = await db.query.boards.findFirst({
    where: (board, { eq, and }) => and(
      eq(board.id, boardId),
      eq(board.userId, userId)
    )
  });
  
  if (!board) throw new Error("Unauthorized");
  return board;
}
```

#### 12. Cross-Site Scripting (XSS) Prevention
- ✅ React escapes by default (good!)
- ✅ Already using DOMPurify (good!)
- ⚠️ Audit any `dangerouslySetInnerHTML` usage
- ✅ Sanitize rich text content from users

#### 13. Dependency Security
```bash
# Run regularly
pnpm audit
pnpm audit fix

# Consider adding to CI/CD
pnpm audit --audit-level=high
```

#### 14. Error Handling
```typescript
// Good: Generic error message
catch (error) {
  console.error("Database error:", error); // Server logs
  return Response.json({ error: "An error occurred" }, { status: 500 });
}

// Bad: Exposes internals
catch (error) {
  return Response.json({ error: error.message }, { status: 500 }); // ❌
}
```

#### 15. CORS Configuration
```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
      ],
    },
  ];
}
```

---

## 💰 Polar.sh vs Stripe Comparison

### Polar.sh Advantages (Already in Starter Kit)
- ✅ **Developer-first**: Better docs, cleaner API
- ✅ **Built-in customer portal**: No need to build subscription management UI
- ✅ **Usage-based billing**: Perfect for AI credits tracking
- ✅ **Lower fees**: 4.1% vs Stripe's 2.9% + $0.30
- ✅ **Designed for SaaS**: Features tailored for subscription products
- ✅ **Webhook signature verification**: Built-in security
- ✅ **Better Auth integration**: Pre-configured in starter
- ✅ **Customer meters**: Track usage per user automatically
- ✅ **Reference system**: Associate purchases with organizations

### Stripe Advantages
- ✅ **More payment methods**: Wider global support
- ✅ **Larger ecosystem**: More integrations available
- ✅ **Brand recognition**: Customers trust/recognize it
- ✅ **More mature**: Been around longer

### Recommendation
**Start with Polar** (already integrated in starter kit). You can add Stripe later if needed.

**Polar is perfect for Mero because:**
1. SaaS subscription model (Pro/Team plans)
2. Usage-based billing for AI credits
3. Automatic customer creation on signup
4. Built-in customer portal (users manage their own subscriptions)
5. Lower fees = more profit

---

## 💳 Recommended Pricing Model for Mero

### Plan Structure

```typescript
// src/lib/plans.ts
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    interval: null,
    features: {
      boards: 3,
      aiGenerations: 10, // per month
      voiceCommands: true,
      storage: "100MB",
      aiImageEdits: 5,
      aiVideos: 0,
    },
    description: "Perfect for trying out Mero",
  },
  
  pro: {
    name: "Pro",
    price: 9.99,
    interval: "month",
    productId: "polar_product_pro_monthly", // From Polar dashboard
    features: {
      boards: Infinity,
      aiGenerations: 100, // per month
      voiceCommands: true,
      storage: "10GB",
      aiImageEdits: 50,
      aiVideos: 10,
      prioritySupport: true,
    },
    description: "For professionals and power users",
  },
  
  team: {
    name: "Team",
    price: 29.99,
    interval: "month",
    productId: "polar_product_team_monthly",
    features: {
      boards: Infinity,
      aiGenerations: 500, // per month
      voiceCommands: true,
      storage: "100GB",
      aiImageEdits: 200,
      aiVideos: 50,
      collaboration: true, // Future: real-time multiplayer
      teamManagement: true,
      prioritySupport: true,
      customBranding: true,
    },
    description: "For teams working together",
  },
};

// Usage tracking
export async function trackUsage(userId: string, action: 'ai_generation' | 'ai_image' | 'ai_video') {
  // Increment counter in database
  // Check against user's plan limits
  // Block if exceeded (or charge overage)
}

// Check if user can perform action
export async function canPerformAction(userId: string, action: string): Promise<boolean> {
  const user = await getUserWithSubscription(userId);
  const plan = PLANS[user.plan || 'free'];
  const usage = await getMonthlyUsage(userId);
  
  switch(action) {
    case 'ai_generation':
      return usage.aiGenerations < plan.features.aiGenerations;
    case 'create_board':
      return usage.boardCount < plan.features.boards;
    // ... etc
  }
}
```

### Add-On Credits (Usage-Based Billing)

```typescript
// For users who exceed their plan limits
export const ADDON_CREDITS = {
  ai_credits_50: {
    name: "50 AI Generations",
    price: 4.99,
    productId: "polar_product_credits_50",
    credits: 50,
  },
  ai_credits_100: {
    name: "100 AI Generations",
    price: 8.99,
    productId: "polar_product_credits_100",
    credits: 100,
  },
  ai_credits_500: {
    name: "500 AI Generations",
    price: 39.99,
    productId: "polar_product_credits_500",
    credits: 500,
  },
};
```

---

## 🗄️ Database Schema Additions for Mero

Add these tables to your starter kit's `src/lib/schema.ts`:

```typescript
import { pgTable, text, timestamp, boolean, integer, jsonb, real } from "drizzle-orm/pg-core";

// Boards table
export const boards = pgTable("boards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  folderId: text("folder_id"),
  panZoom: jsonb("pan_zoom").$type<{ x: number; y: number; k: number }>().default({ x: 0, y: 0, k: 1 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Board items table
export const boardItems = pgTable("board_items", {
  id: text("id").primaryKey(),
  boardId: text("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'sticky-note' | 'text' | 'circle' | 'rectangle' | etc
  x: real("x").notNull(),
  y: real("y").notNull(),
  width: real("width").notNull(),
  height: real("height").notNull(),
  rotation: real("rotation").default(0),
  content: text("content"),
  backgroundColor: text("background_color"),
  textColor: text("text_color"),
  metadata: jsonb("metadata"), // For additional item-specific data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

// Folders table (for organizing boards)
export const folders = pgTable("folders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: text("parent_id"), // For nested folders
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI usage tracking (for billing and rate limiting)
export const aiUsage = pgTable("ai_usage", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'text_generation' | 'image_edit' | 'video_generation'
  model: text("model"), // 'gemini-pro' | 'nano-banana' | 'veo-2'
  tokensUsed: integer("tokens_used"),
  cost: real("cost"), // Track actual API cost
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Subscriptions (synced from Polar webhooks)
export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  polarCustomerId: text("polar_customer_id").notNull(),
  polarSubscriptionId: text("polar_subscription_id").notNull(),
  plan: text("plan").notNull(), // 'free' | 'pro' | 'team'
  status: text("status").notNull(), // 'active' | 'canceled' | 'past_due'
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

After adding, run:
```bash
pnpm db:generate  # Generate migration
pnpm db:migrate   # Apply migration
```

---

## 🚀 Railway Deployment Guide

### Prerequisites
1. Railway account: https://railway.app
2. GitHub repo with your code
3. Polar.sh account: https://polar.sh
4. Google OAuth credentials: https://console.cloud.google.com

### Step 1: Create Railway Project

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project (in your Next.js project directory)
railway init

# Link to existing project (if already created on web)
railway link
```

### Step 2: Add PostgreSQL Database

```bash
# Add PostgreSQL service
railway add postgresql

# Railway automatically creates DATABASE_URL
# No manual connection string needed!
```

### Step 3: Set Environment Variables

In Railway dashboard (Settings → Variables), add:

```bash
# Database (auto-generated by Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}
POSTGRES_URL=${{Postgres.DATABASE_URL}}

# Authentication
BETTER_AUTH_SECRET=<generate-with-openssl-rand-base64-32>
BETTER_AUTH_URL=https://your-app.railway.app

# Google OAuth
# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
# Authorized redirect URI: https://your-app.railway.app/api/auth/callback/google

# AI Services (NEW KEYS - regenerate the old ones!)
GEMINI_API_KEY=your_new_gemini_key_here
FAL_API_KEY=your_new_fal_key_here

# OpenRouter (for chat)
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini

# Polar Payments
# Get from: https://polar.sh/dashboard/settings
POLAR_ACCESS_TOKEN=polar_at_...
POLAR_WEBHOOK_SECRET=polar_wh_...

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.railway.app

# Optional: File storage
BLOB_READ_WRITE_TOKEN=vercel_blob_token_if_using
```

### Step 4: Configure Build Settings

Railway auto-detects Next.js, but verify in `railway.toml`:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "pnpm install && pnpm db:migrate && pnpm build"

[deploy]
startCommand = "pnpm start"
healthcheckPath = "/"
healthcheckTimeout = 100
```

### Step 5: Deploy

```bash
# Deploy from local
railway up

# Or: Push to GitHub, Railway auto-deploys
git push origin main
```

### Step 6: Run Database Migrations

```bash
# SSH into Railway container
railway run pnpm db:migrate

# Or: Migrations run automatically during build (in package.json)
"build": "pnpm db:migrate && next build"
```

### Step 7: Set Up Custom Domain (Optional)

1. Go to Railway dashboard → Settings → Domains
2. Click "Generate Domain" for free `*.railway.app` domain
3. Or add custom domain:
   - Add CNAME record: `your-domain.com` → `your-app.railway.app`
   - Verify in Railway dashboard
   - Update `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`

### Step 8: Configure Google OAuth Redirect

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client
3. Add Authorized redirect URI:
   ```
   https://your-app.railway.app/api/auth/callback/google
   ```

### Step 9: Configure Polar Webhooks

1. Go to [Polar Dashboard](https://polar.sh/dashboard/settings/webhooks)
2. Add webhook endpoint:
   ```
   https://your-app.railway.app/polar/webhooks
   ```
3. Select events to listen for:
   - ✅ subscription.created
   - ✅ subscription.updated
   - ✅ subscription.canceled
   - ✅ order.paid
   - ✅ customer.created
4. Copy webhook secret to Railway env vars

### Step 10: Verify Deployment

```bash
# Check logs
railway logs

# Check service status
railway status

# Open in browser
railway open
```

### Monitoring and Maintenance

```bash
# View logs in real-time
railway logs --follow

# Check database
railway run pnpm db:studio

# Restart service
railway restart

# Check environment variables
railway variables
```

### Troubleshooting

**Build fails with "module not found":**
```bash
# Clear cache and rebuild
railway run pnpm install --force
railway restart
```

**Database connection fails:**
```bash
# Check DATABASE_URL is set
railway variables | grep DATABASE

# Verify migrations ran
railway run pnpm db:migrate
```

**Authentication not working:**
```bash
# Verify redirect URI in Google Console matches:
https://your-app.railway.app/api/auth/callback/google

# Check BETTER_AUTH_URL is correct
railway variables | grep BETTER_AUTH
```

---

## 📝 Migration Checklist

### Phase 1: Setup (1-2 hours)
- [ ] Clone starter kit as new project base
- [ ] Initialize git repository
- [ ] Set up local PostgreSQL (or use Railway from start)
- [ ] Copy `.env.example` to `.env` and fill in values
- [ ] Run `pnpm install`
- [ ] Run `pnpm db:migrate`
- [ ] Test `pnpm dev` - should see starter homepage

### Phase 2: Database Schema (2-3 hours)
- [ ] Add Mero tables to `src/lib/schema.ts`:
  - boards
  - boardItems
  - folders
  - aiUsage
  - subscriptions
- [ ] Run `pnpm db:generate` to create migration
- [ ] Run `pnpm db:migrate` to apply
- [ ] Test database with `pnpm db:studio`

### Phase 3: Port Mero Components (4-6 hours)
- [ ] Create `src/app/canvas` directory
- [ ] Copy Mero components to `src/components/canvas/`:
  - Board.tsx
  - Toolbar.tsx
  - Canvas.tsx
  - All shape components
  - AI modals
- [ ] Copy Mero hooks to `src/hooks/`:
  - useBoard.ts → update to use PostgreSQL
  - useVoiceCommands.ts
  - etc.
- [ ] Copy Mero utilities to `src/lib/`:
  - voiceCommandParser.ts
  - coordinate calculations
  - etc.

### Phase 4: API Routes (3-4 hours)
- [ ] Create `src/app/api/boards/route.ts` - List/create boards
- [ ] Create `src/app/api/boards/[id]/route.ts` - Get/update/delete board
- [ ] Create `src/app/api/items/route.ts` - CRUD for items
- [ ] Create `src/app/api/ai/gemini/route.ts` - Gemini proxy
- [ ] Create `src/app/api/ai/falai/route.ts` - Fal.ai proxy
- [ ] Add authentication checks to all routes
- [ ] Add rate limiting

### Phase 5: Frontend Integration (2-3 hours)
- [ ] Create canvas page at `src/app/canvas/page.tsx`
- [ ] Protect route with auth middleware
- [ ] Update API calls to use new endpoints
- [ ] Test board creation/loading
- [ ] Test item creation/editing
- [ ] Test AI features through proxy

### Phase 6: Payments (2-3 hours)
- [ ] Create Polar products (Free/Pro/Team)
- [ ] Add checkout button to UI
- [ ] Implement subscription checks
- [ ] Test webhook handling
- [ ] Add usage tracking

### Phase 7: Testing (2-3 hours)
- [ ] Test authentication flow
- [ ] Test board CRUD operations
- [ ] Test AI features (with rate limits)
- [ ] Test payment flow
- [ ] Test responsive design
- [ ] Test voice commands

### Phase 8: Deploy (1-2 hours)
- [ ] Create Railway project
- [ ] Add PostgreSQL service
- [ ] Set environment variables
- [ ] Push to GitHub
- [ ] Verify auto-deploy works
- [ ] Run production migrations
- [ ] Test production site
- [ ] Configure custom domain (optional)

**Total Estimated Time:** 20-30 hours (2-4 days of focused work)

---

## 🎨 Additional Features to Consider

### Short Term (Next 1-2 Months)
1. **Email verification** - Better Auth supports this
2. **Password recovery** - Built into Better Auth
3. **Usage dashboard** - Show AI credits remaining
4. **Board templates** - Pre-made boards for common use cases
5. **Export improvements** - Better PDF/PNG quality
6. **Keyboard shortcuts guide** - In-app help overlay

### Medium Term (3-6 Months)
1. **Real-time collaboration** - Multiple users on same board
2. **Comments & annotations** - Team feedback on boards
3. **Version history** - Undo/redo across sessions
4. **Public board sharing** - Share read-only links
5. **Board templates marketplace** - User-created templates
6. **Mobile app** - React Native version

### Long Term (6-12 Months)
1. **Enterprise plan** - SSO, custom hosting, SLA
2. **API access** - Programmatic board manipulation
3. **Integrations** - Slack, Notion, Figma imports
4. **AI agents** - Automated board organization
5. **White-label** - Custom branding for enterprise
6. **On-premise deployment** - For regulated industries

---

## 📚 Resources & Documentation

### Better Auth
- Docs: https://www.better-auth.com/docs
- Examples: https://github.com/better-auth/better-auth/tree/main/examples
- Discord: https://discord.gg/better-auth

### Polar.sh
- Dashboard: https://polar.sh/dashboard
- Sandbox: https://sandbox.polar.sh
- Docs: https://docs.polar.sh
- API Reference: https://docs.polar.sh/api-reference

### Drizzle ORM
- Docs: https://orm.drizzle.team
- Examples: https://github.com/drizzle-team/drizzle-orm/tree/main/examples
- Migrations: https://orm.drizzle.team/docs/migrations

### Railway
- Dashboard: https://railway.app/dashboard
- Docs: https://docs.railway.app
- Templates: https://railway.app/templates
- CLI: https://docs.railway.app/develop/cli

### Next.js 15
- Docs: https://nextjs.org/docs
- App Router: https://nextjs.org/docs/app
- API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

---

## 🎯 Success Metrics to Track

### User Metrics
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Monthly Active Users (MAU)
- User retention (Day 1, Day 7, Day 30)
- Boards created per user
- Items created per user
- Voice commands usage rate

### Business Metrics
- Free → Pro conversion rate (target: 2-5%)
- Pro → Team conversion rate
- Monthly Recurring Revenue (MRR)
- Customer Lifetime Value (LTV)
- Churn rate (target: <5% monthly)
- Average Revenue Per User (ARPU)

### Technical Metrics
- API response times (target: <200ms)
- Error rate (target: <0.1%)
- Uptime (target: 99.9%)
- Database query performance
- AI API success rate
- Voice command accuracy

### Usage Metrics
- AI generations per user
- Most used board features
- Average session duration
- Boards per user
- Items per board
- Voice command adoption rate

**Tools to Use:**
- PostHog (analytics & feature flags)
- Sentry (error tracking)
- Vercel Analytics (performance)
- Railway Metrics (infrastructure)
- Polar Dashboard (payments & subscriptions)

---

## 🚨 Final Security Reminders

1. **REGENERATE THOSE API KEYS** ← Do this first thing tomorrow!
2. **Never commit `.env` files** - Already in `.gitignore` ✅
3. **Use server-side API routes** - Keep keys hidden
4. **Enable rate limiting** - Prevent abuse
5. **Test authentication flow** - Make sure it works
6. **Set up error monitoring** - Know when things break
7. **Regular security audits** - `pnpm audit` monthly
8. **Keep dependencies updated** - Security patches

---

## ✅ Tomorrow's Action Plan

1. **Regenerate API keys** (5 min)
2. **Clone starter kit** as new project (10 min)
3. **Set up local environment** (30 min)
4. **Add Mero database schema** (1 hour)
5. **Port one component** as test (1 hour)
6. **Create one API route** as test (1 hour)
7. **Test authentication** (30 min)
8. **Review progress** and plan next steps

**Total:** ~4 hours to get foundation working

---

## 💪 You've Got This!

Your agentic starter kit gives you a **massive head start**. Instead of spending weeks building auth/DB/payments from scratch, you can focus on what makes Mero special: the infinite canvas experience.

**Key advantages:**
1. Security built-in from day one
2. Authentication just works
3. Payments ready to go
4. Railway deployment is trivial
5. Type-safe everything
6. Modern tech stack

Focus on migrating the canvas features, and you'll have a production-ready app in a week or two!

---

**Questions? Issues?** Document them as you go, and we can address them in the next session.

Good luck! 🚀
