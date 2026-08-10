import { useCallback } from "react";
import { useTheme, type Lang } from "@/lib/theme";

/**
 * Interface language only. Waterbody names, agency notices and quoted source
 * text are never translated — official wording is reproduced, not restated.
 */
type Dict = Record<string, string>;

const es: Dict = {
  // chrome
  "nav.instrument": "Instrumento",
  "nav.plan": "Planear un día",
  "nav.catalog": "Catálogo",
  "nav.boundary": "Límites",
  "chrome.publicOnly": "Solo aguas públicas",
  "chrome.failClosed": "Solo aguas públicas · falla cerrado",
  "chrome.openMenu": "Abrir menú",
  "chrome.closeMenu": "Cerrar menú",
  "chrome.display": "Pantalla",
  "chrome.displayMode": "Modo de pantalla",
  "chrome.motion": "Movimiento",
  "chrome.motionOn": "Activado",
  "chrome.motionOff": "Reducido",
  "chrome.language": "Idioma",
  "chrome.sourceNote":
    "Se traduce la interfaz. Los nombres de las aguas y los avisos oficiales se citan en su idioma publicado.",
  // footer
  "footer.headline": "Aguas públicas con nombre. Nada más.",
  "footer.blurb":
    "Sin sitios privados, sin coordenadas, sin afirmaciones de condiciones en vivo, sin garantías de captura. Si una verificación no se puede completar, el agua se trata como no apta.",
  "footer.instrument": "Instrumento",
  "footer.record": "Registro",
  "footer.planDay": "Planear un día",
  "footer.fullCatalog": "Catálogo completo",
  "footer.boundaryMethod": "Límites y método",
  "footer.schema": "Esquema 0.4.0",
  "footer.waters": "318 aguas con nombre",
  "footer.states": "16 estados",
  "footer.legal":
    "Honey Hole Intelligence — creado para Hook the Horizon. Las fuentes oficiales son autoritativas; la señalización publicada el mismo día prevalece sobre lo impreso aquí.",
  // catalog / search
  "catalog.title": "Catálogo",
  "catalog.search": "Buscar aguas, condados, estados, especies",
  "catalog.searchShort": "Buscar",
  "catalog.filters": "Filtros",
  "catalog.clearAll": "Borrar todo",
  "catalog.results": "resultados",
  "catalog.result": "resultado",
  "catalog.showing": "Mostrando",
  "catalog.of": "de",
  "catalog.loadMore": "Cargar más",
  "catalog.sort": "Orden",
  "catalog.sort.readiness": "Preparación",
  "catalog.sort.verified": "Verificado recientemente",
  "catalog.sort.alpha": "Alfabético",
  "catalog.sort.state": "Estado",
  "catalog.state": "Estado",
  "catalog.type": "Tipo de agua",
  "catalog.band": "Banda de preparación",
  "catalog.noMatch": "Ninguna agua coincide",
  "catalog.noMatchBody":
    "Ninguna agua registrada cumple esa combinación. Amplíe la búsqueda o quite un filtro.",
  "catalog.didYouMean": "¿Quiso decir",
  "catalog.recent": "Búsquedas recientes",
  "catalog.suggestions": "Sugerencias",
  "catalog.apply": "Ver resultados",
  // record
  "record.back": "← Catálogo",
  "record.officialSource": "Fuente oficial",
  "record.buildPacket": "Crear paquete de campo",
  "record.downloadPdf": "Descargar PDF",
  "record.preparingPdf": "Preparando PDF…",
  "record.packet": "Paquete",
  "record.carry": "Llevar",
  "record.copied": "Copiado",
  "record.pdf": "PDF",
};

const dicts: Record<Lang, Dict> = { en: {}, es };

export function translate(lang: Lang, key: string, fallback?: string) {
  return dicts[lang]?.[key] ?? fallback ?? key;
}

/** t("catalog.filters", "Filters") — English text is the key's own fallback. */
export function useT() {
  const { lang } = useTheme();
  return useCallback(
    (key: string, fallback?: string) => translate(lang, key, fallback),
    [lang],
  );
}
