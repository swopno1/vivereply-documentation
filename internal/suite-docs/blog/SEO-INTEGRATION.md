# Blog SEO / AEO / GEO Integration

Every published post is a page that can rank, be quoted by answer engines, and send readers to booking pages. This file shows how post data reaches each discovery surface.

## Single source of "live"

`publishedWhere()` in `src/lib/blog/queries.ts` means `status = PUBLISHED AND publishedAt <= now()`. Every public reader uses it:

- the listing pages (`/blog`, `/blog/category/*`, `/blog/tag/*`)
- the post page and its `generateStaticParams`
- related posts
- RSS
- the sitemap

So drafts, pending, rejected, and archived posts never leak, and neither does a scheduled post before its time. Checked: a `PENDING` guest post's URL rendered the not-found page with `noindex` and none of the post text.

## Post page: `/blog/[slug]`

| Signal | Implementation |
|---|---|
| Rendering | Static generation plus ISR, `revalidate = 3600`. `generateStaticParams` lists live slugs. Publishing, editing, moderating, or deleting calls `revalidateBlog()`, which refreshes the post, listings, `/feed.xml`, and `/sitemap.xml` at once. |
| Canonical | `buildMetadata({ path: /blog/{slug} })` gives an absolute self-canonical on the production domain. |
| hreflang | en / bn-BD / x-default, emitted only when the post has a Bengali title or body. The Bengali version is `?lang=bn`, chosen on the client like the rest of the site (`docs/seo/CONVENTIONS.md §6`). |
| Title / description | `metaTitle` / `metaDescription` (editor shows 60 / 160 counters), falling back to title / excerpt. |
| Open Graph | `og:type=article`. The image is the cover (absolute URL) or the generated OG image. Includes `article:published_time`, `modified_time`, and `author` (when author names are shown). |
| Twitter | `summary_large_image` with the same image. |
| `Article` JSON-LD | Fields: `headline` (≤ 110 chars), `description`, `image`, `datePublished`, `dateModified` (from `updatedAt`), `author`, `publisher` → organization `@id`, `mainEntityOfPage`, `articleSection`, `keywords` (tags), `inLanguage`. `articleBody` is plain text, not markdown. `author` is a `Person` with the bio as `description`; if `showAuthorName` is off, it is the organization `@id`. `src/lib/structured-data/article.ts` |
| `BreadcrumbList` JSON-LD | Home → Blog → Category → Post. The visible `Breadcrumbs` uses the same items array. |
| Direct answer (AEO) | The first paragraph of the post is lifted into a bold standalone `<p data-direct-answer>` at the top. A post that opens with a heading still gets its first paragraph. A post with no paragraph uses its excerpt. The block sits inside `data-speakable="answer"`. |
| Reading time | About 200 words/minute over the rendered text, per language. |
| Author bio | Visible "About the author" block when a bio exists and author names are shown; mirrors the `Person.description`. |
| Internal links | Three most recent live posts in the same category; three top-rated destinations ("Plan your stay") plus experiences; category and tag links. |
| Freshness | "Last updated" appears when `updatedAt` is more than 24 h after publishing. |
| Images | `next/image` with explicit `sizes`, cover `priority` (LCP), alt text required on every image, EXIF stripped, 2400 px cap, 600 w WebP variant used in grids. |
| Guest links | Rendered with `rel="ugc nofollow"`, as Google recommends for user-generated content. External links get `noopener noreferrer`. |

## Listing pages

| Page | Canonical | Indexing |
|---|---|---|
| `/blog` | `/blog` | indexable (`?q=` search results are dynamic and reach the same canonical) |
| `/blog/category/{slug}` | self | indexable. Its own title and description (category description, or a generated one). `?page>1` and `?q=` are `noindex`. |
| `/blog/tag/{slug}` | self | same rules as categories |
| `/blog?category=x`, `/blog?tag=x` (legacy) | — | 308 to the pages above |

## Sitemap: `/sitemap.xml`

`src/app/sitemap.ts` lists:

- every live post (`priority 0.7`, `changeFrequency monthly`, `lastModified = updatedAt`);
- every active category and every tag that has at least one live post (`priority 0.5`, `lastModified` = its newest post's `updatedAt`);
- `/blog` and `/blog/submit` among the static routes.

The sitemap revalidates hourly and on every blog mutation.

## RSS: `/feed.xml`

`src/app/feed.xml/route.ts` is RSS 2.0 with the 50 newest live posts:

- `title`, `link` / `guid` (absolute), `pubDate`, `description` (excerpt), `category`;
- `dc:creator` only when author names are shown (RSS `<author>` must be an email);
- channel `lastBuildDate` is the newest `updatedAt`.

With `enableRss` off, the route returns 404. It revalidates hourly and on every blog mutation, including a settings save.

## Slug stability

A post's slug is locked once it has been public. A MANAGER can still rename it; the old slug then goes into `BlogSlugRedirect`, and `/blog/{old}` returns a 308 to the current slug. Redirects point at the post id, so repeated renames never chain.

## Known limitation (site-wide, not blog-specific)

The root `src/app/loading.tsx` wraps every route in a streaming Suspense boundary. On dynamic routes, `notFound()` therefore returns **HTTP 200** with the not-found UI and `<meta name="robots" content="noindex">`, and `permanentRedirect()` arrives in the stream (308 digest plus meta refresh) rather than as a 308 status line.

Checked on a production build (`next start`): `/destinations/does-not-exist` and `/explore-the-area/does-not-exist` behave the same way, so this predates the blog. Search engines honour the `noindex`, so no soft-404 page gets indexed. Fixing the status codes means moving `loading.tsx` into specific segments, which changes every route. It is left for a site-wide change (see CURRENT-STATE.md §3).
