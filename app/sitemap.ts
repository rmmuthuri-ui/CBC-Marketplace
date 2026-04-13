import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://cbcmarketplace.co.ke'

  const staticPages = [
    '',
    '/subjects/mathematics',
    '/subjects/science-technology',
    '/subjects/english',
  ]

  const products = [
    'acids-bases-and-salts',
    'atoms-elements-compounds',
    'chemical-reactions-metals',
    'circle-parts-of-a-circle',
    'electrochemistry',
    'experimental-techniques',
    'finding-the-nth-term',
    'laws-of-indices',
    'organic-chemistry',
    'periodic-table',
    'similar-shapes',
    'states-of-matter',
    'stoichiometry',
    'straight-line-graphs'
  ]

  const staticUrls = staticPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
  }))

  const productUrls = products.map((slug) => ({
    url: `${baseUrl}/products/${slug}`,
    lastModified: new Date(),
  }))

  return [...staticUrls, ...productUrls]
}
