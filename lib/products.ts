import { supabase } from "@/lib/supabase";

export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  subject: string;
  grade: string;
};

type ProductResult = {
  data: Product[] | null;
  error: string | null;
};

export async function getAllProducts(): Promise<ProductResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, price, subject, grade")
    .order("title", { ascending: true });

  return {
    data: (data as Product[] | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function getProductsBySubject(subject: string): Promise<ProductResult> {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, price, subject, grade")
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
  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, price, subject, grade")
    .eq("id", id)
    .single();

  return {
    data: (data as Product | null) ?? null,
    error: error?.message ?? null,
  };
}
