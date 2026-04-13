import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://cbcmarketplace.co.ke',
      lastModified: new Date(),
    },
  ]
}
