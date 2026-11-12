import { useEffect, useState } from "react";
import Masonry from "../components/Masonry";
import { useCompany } from "../lib/company";
import { useGallery } from "../lib/gallery";

/** 5 colunas a partir de 768 px; abaixo disso, 2 (5 colunas ficariam pequenas demais no celular). */
function useColumns(): number {
  const query = "(min-width: 768px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setWide(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return wide ? 5 : 2;
}

/** Secao Galeria da pagina inicial. Sem imagens cadastradas no painel, nao renderiza nada. */
export function GallerySection() {
  const company = useCompany();
  const { items } = useGallery();
  const columns = useColumns();
  if (items.length === 0) return null;

  return (
    <section id="galeria" className="mx-auto max-w-[1400px] px-5 pb-14 md:px-10">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.19em] text-brand-500">Galeria</p>
      <h2 className="mb-2 mt-3 text-2xl text-navy-900 md:text-3xl">Nossa galeria</h2>
      <p className="mb-6 max-w-xl text-sm text-muted">Registros dos treinamentos e da estrutura de {company.name}. Clique em uma imagem para ampliar.</p>
      <Masonry items={items} columns={columns} columnWidth={180} gap={12} radius={12} animateFrom="bottom" hoverEffect="zoom" captions="hover" lightbox draggable={false} />
    </section>
  );
}
