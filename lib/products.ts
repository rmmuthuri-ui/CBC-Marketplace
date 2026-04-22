import { supabase } from "@/lib/supabase";

export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  subject: string;
  grade: string;
  file_url: string;
};

type ProductResult = {
  data: Product[] | null;
  error: string | null;
};

export async function getAllProducts(): Promise<ProductResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, price, subject, grade, file_url")
    .order("title", { ascending: true });

  return {
    data: (data as Product[] | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function getProductsBySubject(subject: string): Promise<ProductResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, price, subject, grade, file_url")
    .ilike("subject", subject)
    .order("title", { ascending: true });

  return {
    data: (data as Product[] | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function getProductById(id: string): Promise<{
  data: Product | null;
  error: string | null;
}> {
  const normalizedId = id.trim();

  if (!normalizedId) {
    return { data: null, error: null };
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, price, subject, grade, file_url")
    .eq("id", normalizedId)
    .maybeSingle();

  return {
    data: (data as Product | null) ?? null,
    error: error?.message ?? null,
  };
}
