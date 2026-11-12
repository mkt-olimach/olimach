import { publicGalleryRowSchema } from "@olimach/schemas";
import { useEffect, useState } from "react";
import type { MasonryItem } from "../components/Masonry";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Imagens da galeria cadastradas no painel (RPC public.public_gallery; o anon nao le a tabela). */
export async function fetchGallery(signal?: AbortSignal): Promise<MasonryItem[] | null> {
  if (!url || !anonKey) return null;
  const response = await fetch(`${url}/rest/v1/rpc/public_gallery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: "{}",
    signal,
  });
  if (!response.ok) throw new Error(`public_gallery ${response.status}`);
  return publicGalleryRowSchema
    .array()
    .parse(await response.json())
    .map((row) => ({
      id: row.id,
      img: `${url}/storage/v1/object/public/gallery/${row.path.split("/").map(encodeURIComponent).join("/")}`,
      width: row.width,
      height: row.height,
      title: row.title || undefined,
      description: row.description || undefined,
      alt: row.title || "Imagem da galeria",
    }));
}

export interface GalleryState {
  items: MasonryItem[];
  loading: boolean;
  failed: boolean;
}

export function useGallery(): GalleryState {
  const [state, setState] = useState<GalleryState>({ items: [], loading: true, failed: false });
  useEffect(() => {
    const controller = new AbortController();
    fetchGallery(controller.signal)
      .then((items) => setState({ items: items ?? [], loading: false, failed: items === null }))
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setState({ items: [], loading: false, failed: true });
      });
    return () => controller.abort();
  }, []);
  return state;
}
