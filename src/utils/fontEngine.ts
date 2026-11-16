import type { CustomFont } from '../types/models';

const STYLE_ELEMENT_ID = 'et-bsp-custom-fonts';

export const BUILTIN_FONTS = [
  'Plus Jakarta Sans',
  'Outfit',
  'DM Sans',
  'Playfair Display',
  'Merriweather',
];

function sanitizeFontName(raw: string): string {
  return raw
    .replace(/\.[^.]+$/, '')
    .replace(/['"`]/g, '')
    .trim() || 'Custom Font';
}

function escapeCssString(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function readFontFileAsCustomFont(file: File): Promise<CustomFont> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read font file'));
    reader.readAsDataURL(file);
  });

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return {
    id: `font_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: sanitizeFontName(file.name),
    dataUrl,
    format: ext,
    createdAt: new Date().toISOString(),
  };
}

export function loadCustomFontsIntoDocument(fonts: CustomFont[]): void {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleEl);
  }

  const rules = fonts
    .filter((f) => f.name && f.dataUrl)
    .map((f) => {
      const safeName = escapeCssString(f.name);
      return `@font-face {\n  font-family: "${safeName}";\n  src: url("${f.dataUrl}");\n  font-display: swap;\n}`;
    })
    .join('\n');

  styleEl.textContent = rules;

  // Also trigger browser FontFace loading when supported for instant canvas readiness
  if (typeof FontFace !== 'undefined' && document.fonts) {
    for (const f of fonts) {
      if (!f.name || !f.dataUrl) continue;
      const alreadyLoaded = Array.from(document.fonts).some(
        (df) => df.family.replace(/['"]/g, '') === f.name && df.status === 'loaded'
      );
      if (!alreadyLoaded) {
        try {
          const face = new FontFace(f.name, `url("${f.dataUrl}")`);
          face.load().then((loaded) => {
            document.fonts.add(loaded);
          }).catch(() => {});
        } catch {
          // Style tag @font-face handles fallback
        }
      }
    }
  }
}

export function normalizeFontFamilyName(rawFontFamily: string): string {
  if (!rawFontFamily) return 'Plus Jakarta Sans';
  // Handle legacy CSS font-family strings like "'Geist-Bold',sans-serif"
  const first = rawFontFamily.split(',')[0]?.trim() || '';
  return first.replace(/^['"]+|['"]+$/g, '') || 'Plus Jakarta Sans';
}
