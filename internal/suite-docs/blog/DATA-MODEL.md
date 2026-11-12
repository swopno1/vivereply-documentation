# Blog Data Model

The source of truth is `prisma/schema.prisma`. This file copies the blog models and explains the choices behind them. Migrations:

| Migration | What it does |
|---|---|
| `20260929033828_init_postgres` | Creates `BlogPost`, `BlogImage`, `BlogCategory`, `BlogTag`, `BlogSettings`, `BlogSubmissionAttempt`, and the `_BlogPostTags` join table. |
| `20260929091811_blog_hardening` | Additive only. Adds `BlogPost.contentHash`/`flagReason`, `BlogImage.storageKey`/`variantUrl`, four guest anti-abuse settings, the `BlogSlugRedirect` table, and a `BlogSubmissionAttempt.createdAt` index. Inserts the `BlogSettings` singleton (`ON CONFLICT DO NOTHING`). |

## Schema

```prisma
model BlogPost {
  id              String   @id @default(cuid())
  slug            String   @unique
  title           String
  titleBn         String?
  excerpt         String
  excerptBn       String?
  content         String   // Markdown
  contentBn       String?  // Markdown
  coverImageUrl   String?
  coverImageAlt   String?

  status          BlogPostStatus @default(DRAFT)
  source          BlogPostSource @default(STAFF)

  authorId        String?             // Null for guest submissions
  author          User?    @relation("BlogAuthor", fields: [authorId], references: [id], onDelete: SetNull)
  authorName      String               // Denormalized for guests
  authorEmail     String?              // Guests only
  authorPhone     String?              // Guests only
  authorBio       String?              // Short bio shown on post
  authorIp        String?              // For guest abuse tracking

  categoryId      String?
  category        BlogCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  tags            BlogTag[]     @relation("BlogPostTags")

  publishedAt     DateTime?
  scheduledFor    DateTime?            // For future-dated publishing

  moderatedById   String?
  moderatedBy     User?    @relation("BlogModerator", fields: [moderatedById], references: [id], onDelete: SetNull)
  moderatedAt     DateTime?
  moderationNote  String?              // Internal note, not shown to guest

  rejectionReason String?              // Shown to guest in rejection email

  viewCount       Int      @default(0)
  featured        Boolean  @default(false)

  metaTitle       String?
  metaDescription String?
  metaTitleBn     String?
  metaDescriptionBn String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String?
  archivedAt      DateTime?

  images          BlogImage[]
  slugRedirects   BlogSlugRedirect[]

  contentHash     String?              // SHA-256 of normalized content, for 7-day duplicate detection
  flagReason      String?              // Why the anti-abuse pipeline held a guest post for review

  @@index([status, publishedAt])
  @@index([contentHash, createdAt])
  @@index([authorId])
  @@index([categoryId])
  @@index([slug])
}

enum BlogPostStatus {
  DRAFT
  PENDING
  PUBLISHED
  REJECTED
  ARCHIVED
}

enum BlogPostSource {
  STAFF
  GUEST
}

model BlogImage {
  id            String   @id @default(cuid())
  postId        String
  post          BlogPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  url           String
  alt           String
  caption       String?
  displayOrder  Int      @default(0)
  width         Int?
  height        Int?
  fileSize      Int?
  mimeType      String?
  contentHash   String               // SHA-256 of the processed image bytes
  storageKey    String?              // R2 object key, so hard deletes can remove the file
  variantUrl    String?              // 600w WebP for grids and lists
  createdAt     DateTime @default(now())

  @@index([postId])
  @@index([contentHash])
}

model BlogCategory {
  id            String   @id @default(cuid())
  slug          String   @unique
  name          String
  nameBn        String?
  description   String?
  displayOrder  Int      @default(0)
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())

  posts         BlogPost[]
}

model BlogTag {
  id            String   @id @default(cuid())
  slug          String   @unique
  name          String
  nameBn        String?
  createdAt     DateTime @default(now())

  posts         BlogPost[] @relation("BlogPostTags")
}

model BlogSettings {
  id                       String   @id @default("singleton")

  // Guest submission controls
  guestPostsEnabled        Boolean  @default(true)
  guestModerationRequired  Boolean  @default(true)
  guestMaxImages           Int      @default(3)
  guestMinImages           Int      @default(1)
  guestMaxContentLength    Int      @default(10000)  // chars
  guestMinContentLength    Int      @default(300)
  guestAllowedCategories   String?                    // JSON array of category IDs, null = all
  guestRateLimitPerIp      Int      @default(3)       // per 24 hours
  guestRequireEmailVerify  Boolean  @default(false)   // future: email link confirm
  guestRateLimitPerHour    Int      @default(2)
  guestAllowUrls           Boolean  @default(true)    // false = any URL in the body holds the post for review
  guestMaxUrls             Int      @default(3)       // more external URLs than this = rejected
  guestMaxCapsWords        Int      @default(10)      // more ALL-CAPS words than this = held for review

  // Staff post controls
  staffMaxImages           Int      @default(10)
  staffPostsAutoPublish    Boolean  @default(true)

  // Global image rules
  allowedMimeTypes         String   @default("[\"image/jpeg\",\"image/png\",\"image/webp\"]")
  maxImageSizeMb           Int      @default(5)

  // Notifications
  notifyEmail              String?                    // Admin email for new guest submissions
  sendGuestConfirmation    Boolean  @default(true)

  // Public display
  postsPerPage             Int      @default(12)
  showAuthorName           Boolean  @default(true)
  enableRss                Boolean  @default(true)

  updatedAt                DateTime @updatedAt
  updatedBy                String?
}

model BlogSubmissionAttempt {
  id            String   @id @default(cuid())
  ipHash        String
  email         String?
  title         String?
  status        String   // "SUCCESS", "REJECTED_SPAM", "RATE_LIMITED", "TURNSTILE_FAILED"
  reason        String?
  createdAt     DateTime @default(now())

  @@index([ipHash, createdAt])
  @@index([createdAt])
}

/// Old slug of a published post. /blog/{fromSlug} permanently redirects to the post's current slug.
model BlogSlugRedirect {
  id        String   @id @default(cuid())
  fromSlug  String   @unique
  postId    String
  post      BlogPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([postId])
}
```

The only change to `User` is two reverse relations: `blogPosts` (`"BlogAuthor"`) and `moderatedPosts` (`"BlogModerator"`). `Booking`, `Payment`, and `Guest` are untouched.

## Differences from the spec, and why

| Spec | Implemented | Reason |
|---|---|---|
| `@db.Text` on long strings | Plain `String` | On PostgreSQL, Prisma `String` is already `text`. |
| No slug history | `BlogSlugRedirect` | Published slugs are immutable. Renaming one (MANAGER+) leaves a permanent redirect behind. |
| No dedup column on posts | `BlogPost.contentHash` | The 7-day duplicate check for guest content looks up an indexed SHA-256 of the normalized body. |
| Flag reason mixed into `moderationNote` | `BlogPost.flagReason` | Anti-abuse flags stay separate from the moderator's internal note. |
| `BlogImage.url` only | `+ storageKey`, `variantUrl` | `storageKey` lets a hard delete remove the R2 objects. `variantUrl` is the `-600w.webp` used in grids. |
| Rate limit per 24h only | `+ guestRateLimitPerHour` | Section 10 asks for per-hour and per-day limits. |
| URL / ALL-CAPS rules hard-coded | `guestAllowUrls`, `guestMaxUrls`, `guestMaxCapsWords` | Section 4.4 and Section 10 say these must be configurable. |
| `BlogSubmissionAttempt` (optional) | Kept | This table logs every accepted, held, or rejected guest submission and drives the rate limit. |

## Relations and delete behaviour

- `BlogPost.author` / `moderatedBy` → `User`, `onDelete: SetNull`. Removing a staff account keeps its posts, because `authorName` is denormalized.
- `BlogPost.category` → `SetNull`. Deleting a category leaves its posts uncategorized.
- `BlogImage`, `BlogSlugRedirect` → `Cascade` from `BlogPost`. The R2 objects are deleted by the application before the row is deleted (see `GUEST-SUBMISSION.md` → Images).
- Tags are many-to-many through the implicit `_BlogPostTags` table.

## Seeding

`prisma/seed.ts` `seedBlog()` is idempotent. It upserts the settings singleton, three categories, four tags, and one `PUBLISHED` staff post per markdown file in `src/content/blog/`, keyed by slug. Existing rows are never overwritten or deleted. The markdown files are seed data only; the live blog reads from the database.
