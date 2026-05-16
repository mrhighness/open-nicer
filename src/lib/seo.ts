import { OPEN_SOURCE_STATEMENT, PRODUCT, PRODUCT_SPEC } from "@/lib/product";
import { getSiteOrigin, inviteOgTitle } from "@/lib/share";

/** UTF-8 em dash — use this constant so titles never show mojibake (â€"). */
export const EM_DASH = "\u2014";

export const SEO = {
  siteName: PRODUCT.name,
  defaultTitle: `${PRODUCT.name} ${EM_DASH} Free messaging, no sign-up`,
  defaultDescription: `${PRODUCT.name} ${EM_DASH} ${PRODUCT.shortDescription} Real-time chat, voice & video calls, groups. Open source (MIT) from Nicle Inc.`,
  keywords: [
    "Open Nicer",
    "free messaging app",
    "chat without sign up",
    "instant messaging",
    "no account chat",
    "open source messenger",
    "WebRTC calls",
    "private messaging",
    "Nicle Inc",
    "Mr. Highness Chinedu",
  ].join(", "),
  locale: "en_US",
  twitterHandle: "@OpenNicer",
} as const;

type HeadMeta =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

type HeadLink = { rel: string; href: string } | { rel: string; href: string; crossOrigin?: string };

export function absoluteUrl(path: string, origin?: string): string {
  const base = getSiteOrigin(origin);
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function absoluteAsset(path: string, origin?: string): string {
  const url = absoluteUrl(path, origin);
  return url.startsWith("http") ? url : path;
}

/** Block search engines from indexing private in-app surfaces (chats, settings). */
export function robotsPrivate(): HeadMeta[] {
  return [
    { name: "robots", content: "noindex, nofollow, noarchive, nosnippet" },
    { name: "googlebot", content: "noindex, nofollow" },
  ];
}

/** Allow indexing for marketing pages and public invite profiles. */
export function robotsPublic(): HeadMeta[] {
  return [
    { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
    { name: "googlebot", content: "index, follow" },
  ];
}

export function pageHead(opts: {
  title: string;
  description: string;
  path?: string;
  origin?: string;
  image?: string;
  ogType?: string;
  index?: boolean;
  /** Extra meta tags (e.g. profile-specific og:url). */
  extra?: HeadMeta[];
}): { meta: HeadMeta[]; links: HeadLink[]; scripts?: { type: string; children: string }[] } {
  const origin = opts.origin;
  const canonical = opts.path ? absoluteUrl(opts.path, origin) : absoluteUrl("/", origin);
  const image = opts.image
    ? opts.image.startsWith("http")
      ? opts.image
      : absoluteUrl(opts.image, origin)
    : absoluteUrl(PRODUCT.logoUrl, origin);
  const index = opts.index !== false;

  const meta: HeadMeta[] = [
    { title: opts.title },
    { name: "description", content: opts.description },
    { name: "keywords", content: SEO.keywords },
    { name: "application-name", content: PRODUCT.name },
    ...(index ? robotsPublic() : robotsPrivate()),
    { property: "og:site_name", content: SEO.siteName },
    { property: "og:locale", content: SEO.locale },
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:type", content: opts.ogType ?? "website" },
    { property: "og:url", content: canonical },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: opts.description },
    { name: "twitter:image", content: image },
    ...(opts.extra ?? []),
  ];

  const links: HeadLink[] = [{ rel: "canonical", href: canonical }];

  return { meta, links };
}

export function homePageHead(origin?: string) {
  return {
    ...pageHead({
      title: SEO.defaultTitle,
      description: SEO.defaultDescription,
      path: "/",
      origin,
      ogType: "website",
    }),
    scripts: [jsonLdScript(webAppJsonLd(origin))],
  };
}

export function aboutPageHead(origin?: string) {
  return {
    ...pageHead({
      title: `About ${PRODUCT.name} ${EM_DASH} Open-source messenger`,
      description: `${OPEN_SOURCE_STATEMENT} ${PRODUCT.tagline}`,
      path: "/about",
      origin,
    }),
    scripts: [jsonLdScript(organizationJsonLd(origin))],
  };
}

export function privateChatHead() {
  return pageHead({
    title: `Private chat | ${PRODUCT.name}`,
    description: `Your private conversation on ${PRODUCT.name}. Message content is not indexed by search engines.`,
    index: false,
  });
}

export function profileInviteHead(opts: {
  username: string;
  description: string;
  url: string;
  image: string;
  userId: string;
  origin?: string;
}) {
  const title = inviteOgTitle(opts.username);
  return {
    ...pageHead({
      title,
      description: opts.description,
      path: `/u/${opts.userId}`,
      origin: opts.origin,
      image: opts.image,
      ogType: "profile",
      extra: [
        { property: "og:profile:username", content: opts.username },
        { name: "twitter:card", content: "summary" },
      ],
    }),
    scripts: [
      jsonLdScript(
        profilePageJsonLd({
          username: opts.username,
          url: opts.url,
          image: opts.image,
          description: opts.description,
        })
      ),
    ],
  };
}

function jsonLdScript(data: Record<string, unknown>) {
  return {
    type: "application/ld+json",
    children: JSON.stringify(data),
  };
}

function webAppJsonLd(origin?: string) {
  const url = absoluteUrl("/", origin);
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: PRODUCT.name,
    url,
    applicationCategory: "CommunicationApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: PRODUCT.shortDescription,
    featureList: PRODUCT_SPEC.features.map((f) => f.title),
    author: {
      "@type": "Person",
      name: PRODUCT.author.name,
      alternateName: PRODUCT.author.alias,
    },
    publisher: { "@type": "Organization", name: "Nicle Inc." },
  };
}

function organizationJsonLd(origin?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Nicle Inc.",
    url: absoluteUrl("/about", origin),
    brand: { "@type": "Brand", name: PRODUCT.name },
    description: OPEN_SOURCE_STATEMENT,
  };
}

function profilePageJsonLd(opts: {
  username: string;
  url: string;
  image: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${opts.username} on ${PRODUCT.name}`,
    description: opts.description,
    url: opts.url,
    mainEntity: {
      "@type": "Person",
      name: opts.username,
      image: opts.image,
      description: opts.description,
    },
    isPartOf: {
      "@type": "WebApplication",
      name: PRODUCT.name,
      description: PRODUCT.tagline,
    },
  };
}
