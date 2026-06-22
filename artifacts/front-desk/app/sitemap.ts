import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://amisemedical.com';
  const now = new Date().toISOString();

  return [
    { url: base,              lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/book`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/guidance`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/pathway`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/refer`,   lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
