import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';
import { getApprovedArticles } from '@/content/health-info';

type Entry = MetadataRoute.Sitemap[number];

// Canonical URLs only (lib/site.ts), whichever domain serves the sitemap.
const PAGES: { path: string; changeFrequency: Entry['changeFrequency']; priority: number }[] = [
  { path: '/',                        changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/book',                    changeFrequency: 'weekly',  priority: 0.9 },
  { path: '/guidance',                changeFrequency: 'monthly', priority: 0.7 },
  { path: '/services/endoscopy',      changeFrequency: 'monthly', priority: 0.7 },
  { path: '/services/ercp',           changeFrequency: 'monthly', priority: 0.7 },
  { path: '/services/breast-clinic',  changeFrequency: 'monthly', priority: 0.7 },
  { path: '/services/diabetic-foot',  changeFrequency: 'monthly', priority: 0.7 },
  { path: '/pathway',                 changeFrequency: 'monthly', priority: 0.6 },
  { path: '/refer',                   changeFrequency: 'monthly', priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  const pages: MetadataRoute.Sitemap = PAGES.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // Health information: approved articles only (drafts are 404 publicly).
  const articles = getApprovedArticles();
  if (articles.length > 0) {
    pages.push({ url: absoluteUrl('/health-information'), lastModified: now, changeFrequency: 'monthly', priority: 0.7 });
    for (const a of articles) {
      pages.push({
        url: absoluteUrl(`/health-information/${a.slug}`),
        lastModified: a.lastReviewed ?? now,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }
  return pages;
}
