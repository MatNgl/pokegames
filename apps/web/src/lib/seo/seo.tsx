import { useLocation } from 'react-router-dom';
import { SITE_NAME, SITE_URL, buildJsonLd, findRouteMeta } from './site-meta';

/**
 * Metadonnees de la page courante. React 19 hoiste nativement title, meta et link dans le <head>,
 * donc aucune dependance type react-helmet n'est necessaire.
 *
 * Le prerendu du build ecrit deja ces balises dans le HTML statique (pour les crawlers sans JS) ;
 * ce composant les maintient a jour lors de la navigation cote client.
 */
export function Seo() {
  const { pathname } = useLocation();
  const meta = findRouteMeta(pathname);
  if (!meta) return null;

  const url = `${SITE_URL}${meta.path === '/' ? '/' : meta.path}`;
  const image = `${SITE_URL}/og-image.png`;

  return (
    <>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={url} />
      {!meta.indexable && <meta name="robots" content="noindex, follow" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="fr_FR" />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={image} />

      {meta.path === '/' && (
        <script type="application/ld+json">{JSON.stringify(buildJsonLd())}</script>
      )}
    </>
  );
}
