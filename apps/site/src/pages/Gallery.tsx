import Masonry from "../components/Masonry";
import { useCompany } from "../lib/company";
import { useGallery } from "../lib/gallery";

/** Galeria de imagens (cadastradas no painel), em colunas de 180 px. */
export function Gallery() {
  const company = useCompany();
  const { items, loading, failed } = useGallery();

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-12 md:px-10">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.19em] text-brand-500">Galeria</p>
      <h1 className="mb-2 mt-3 text-3xl text-navy-900 md:text-4xl">Galeria de imagens</h1>
      <p className="mb-8 max-w-xl text-sm text-muted">Registros dos treinamentos e da estrutura de {company.name}. Clique em uma imagem para ampliar.</p>

      {loading ? (
        <p className="text-muted">Carregando imagens...</p>
      ) : failed ? (
        <p className="text-muted">Não foi possível carregar a galeria agora. Tente novamente em instantes.</p>
      ) : items.length === 0 ? (
        <p className="text-muted">Em breve, novas imagens por aqui.</p>
      ) : (
        <Masonry items={items} columnWidth={180} gap={12} radius={12} animateFrom="bottom" hoverEffect="zoom" captions="hover" lightbox draggable={false} />
      )}
    </section>
  );
}
