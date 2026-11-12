import { publicCourseSchema } from "@olimach/schemas";
import type { PublicCourse } from "@olimach/schemas";
import { useEffect, useState } from "react";
import { courses as fallbackCourses } from "../content/courses";
import type { SiteCourse } from "../content/courses";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Capas ficam em bucket publico (course-covers); o caminho vem do RPC, nunca de entrada do usuario. */
function coverUrl(path: string | null): string | null {
  if (!url || !path) return null;
  return `${url}/storage/v1/object/public/course-covers/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function tagFor(c: PublicCourse): string {
  return c.nr_code ?? (c.category === "profissionalizante" ? "Profissionalizante" : "Parceria");
}

/** Treinamentos ativos cadastrados no painel. Chama o RPC public.public_courses (o anon nao le a tabela). */
export async function fetchCatalog(signal?: AbortSignal): Promise<SiteCourse[] | null> {
  if (!url || !anonKey) return null;
  const response = await fetch(`${url}/rest/v1/rpc/public_courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: "{}",
    signal,
  });
  if (!response.ok) throw new Error(`public_courses ${response.status}`);
  return publicCourseSchema
    .array()
    .parse(await response.json())
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      category: c.category,
      summary: c.description.trim() || null,
      tag: tagFor(c),
      coverUrl: coverUrl(c.cover_path),
      workloadHours: c.workload_hours,
      theoryHours: c.theory_hours,
      practiceHours: c.practice_hours,
      modality: c.modality,
    }));
}

export interface CatalogState {
  courses: SiteCourse[];
  loading: boolean;
}

/**
 * Lista de cursos da landing. Com o banco configurado, mostra exatamente os treinamentos ativos
 * cadastrados no painel. Sem configuracao ou se a consulta falhar, usa a lista estatica do conteudo.
 */
export function useCatalog(): CatalogState {
  const configured = Boolean(url && anonKey);
  const [state, setState] = useState<CatalogState>({ courses: configured ? [] : fallbackCourses, loading: configured });

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    fetchCatalog(controller.signal)
      .then((list) => setState({ courses: list ?? fallbackCourses, loading: false }))
      .catch((err: unknown) => {
        if ((err as { name?: string }).name !== "AbortError") setState({ courses: fallbackCourses, loading: false });
      });
    return () => controller.abort();
  }, [configured]);

  return state;
}
