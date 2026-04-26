import { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/products";
import { MARKETPLACE_SUBJECTS, subjectToSlug } from "@/lib/subjects";

const BASE_URL = "https://www.cbcmarketplace.co.ke";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages = ["", "/subjects/mathematics", "/subjects/science-technology", "/subjects/english"];
  const subjectPages = MARKETPLACE_SUBJECTS.map((subject) => `/subjects/${subjectToSlug(subject)}`);

  const staticUrls = [...new Set([...staticPages, ...subjectPages])].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  let productUrls: MetadataRoute.Sitemap = [];
  try {
    const products = await getAllProducts();
    productUrls = (products.data ?? []).map((product) => ({
      url: `${BASE_URL}/product/${product.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // Return static URLs even if product fetch fails.
  }

  return [...staticUrls, ...productUrls];
}
