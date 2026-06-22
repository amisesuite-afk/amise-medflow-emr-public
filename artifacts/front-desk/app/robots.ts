import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/patient/', '/questionnaire/'],
      },
    ],
    sitemap: 'https://amisemedical.com/sitemap.xml',
  };
}
