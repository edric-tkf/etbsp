import type {
  BibleBook,
  BibleChapter,
  BibleSlidePayload,
  BibleTranslation,
  BibleVerse,
} from '../types/models';

export interface BibleBookMeta {
  order: number;
  name: string;
  aliases: string[];
  chapters: number;
}

export const BIBLE_CANON: BibleBookMeta[] = [
  { order: 1, name: 'Genesis', aliases: ['gen', 'ge', 'gn'], chapters: 50 },
  { order: 2, name: 'Exodus', aliases: ['exod', 'ex', 'exo'], chapters: 40 },
  { order: 3, name: 'Leviticus', aliases: ['lev', 'le', 'lv'], chapters: 27 },
  { order: 4, name: 'Numbers', aliases: ['num', 'nu', 'nm', 'nb'], chapters: 36 },
  { order: 5, name: 'Deuteronomy', aliases: ['deut', 'de', 'dt'], chapters: 34 },
  { order: 6, name: 'Joshua', aliases: ['josh', 'jos', 'jsh'], chapters: 24 },
  { order: 7, name: 'Judges', aliases: ['judg', 'jdg', 'jg', 'jdgs'], chapters: 21 },
  { order: 8, name: 'Ruth', aliases: ['rth', 'ru'], chapters: 4 },
  { order: 9, name: '1 Samuel', aliases: ['1sam', '1sa', '1s', '1 sam', '1st samuel'], chapters: 31 },
  { order: 10, name: '2 Samuel', aliases: ['2sam', '2sa', '2s', '2 sam', '2nd samuel'], chapters: 24 },
  { order: 11, name: '1 Kings', aliases: ['1kgs', '1ki', '1k', '1 kings', '1st kings'], chapters: 22 },
  { order: 12, name: '2 Kings', aliases: ['2kgs', '2ki', '2k', '2 kings', '2nd kings'], chapters: 25 },
  { order: 13, name: '1 Chronicles', aliases: ['1chr', '1ch', '1 chr', '1st chronicles'], chapters: 29 },
  { order: 14, name: '2 Chronicles', aliases: ['2chr', '2ch', '2 chr', '2nd chronicles'], chapters: 36 },
  { order: 15, name: 'Ezra', aliases: ['ezr', 'ez'], chapters: 10 },
  { order: 16, name: 'Nehemiah', aliases: ['neh', 'ne'], chapters: 13 },
  { order: 17, name: 'Esther', aliases: ['esth', 'est', 'es'], chapters: 10 },
  { order: 18, name: 'Job', aliases: ['jb'], chapters: 42 },
  { order: 19, name: 'Psalms', aliases: ['ps', 'psa', 'psm', 'pss', 'psalm'], chapters: 150 },
  { order: 20, name: 'Proverbs', aliases: ['prov', 'pro', 'prv', 'pr'], chapters: 31 },
  { order: 21, name: 'Ecclesiastes', aliases: ['eccl', 'ecc', 'ec', 'qoh'], chapters: 12 },
  { order: 22, name: 'Song of Solomon', aliases: ['song', 'sos', 'so', 'canticles', 'song of songs'], chapters: 8 },
  { order: 23, name: 'Isaiah', aliases: ['isa', 'is'], chapters: 66 },
  { order: 24, name: 'Jeremiah', aliases: ['jer', 'je', 'jr'], chapters: 52 },
  { order: 25, name: 'Lamentations', aliases: ['lam', 'la'], chapters: 5 },
  { order: 26, name: 'Ezekiel', aliases: ['ezek', 'eze', 'ezk'], chapters: 48 },
  { order: 27, name: 'Daniel', aliases: ['dan', 'da', 'dn'], chapters: 12 },
  { order: 28, name: 'Hosea', aliases: ['hos', 'ho'], chapters: 14 },
  { order: 29, name: 'Joel', aliases: ['joe', 'jl'], chapters: 3 },
  { order: 30, name: 'Amos', aliases: ['amo', 'am'], chapters: 9 },
  { order: 31, name: 'Obadiah', aliases: ['obad', 'ob'], chapters: 1 },
  { order: 32, name: 'Jonah', aliases: ['jon', 'jnh'], chapters: 4 },
  { order: 33, name: 'Micah', aliases: ['mic', 'mc'], chapters: 7 },
  { order: 34, name: 'Nahum', aliases: ['nah', 'na'], chapters: 3 },
  { order: 35, name: 'Habakkuk', aliases: ['hab', 'hb'], chapters: 3 },
  { order: 36, name: 'Zephaniah', aliases: ['zeph', 'zep', 'zp'], chapters: 3 },
  { order: 37, name: 'Haggai', aliases: ['hag', 'hg'], chapters: 2 },
  { order: 38, name: 'Zechariah', aliases: ['zech', 'zec', 'zc'], chapters: 14 },
  { order: 39, name: 'Malachi', aliases: ['mal', 'ml'], chapters: 4 },
  { order: 40, name: 'Matthew', aliases: ['matt', 'mat', 'mt'], chapters: 28 },
  { order: 41, name: 'Mark', aliases: ['mrk', 'mar', 'mk', 'mr'], chapters: 16 },
  { order: 42, name: 'Luke', aliases: ['luk', 'lk'], chapters: 24 },
  { order: 43, name: 'John', aliases: ['joh', 'jhn', 'jn'], chapters: 21 },
  { order: 44, name: 'Acts', aliases: ['act', 'ac'], chapters: 28 },
  { order: 45, name: 'Romans', aliases: ['rom', 'ro', 'rm'], chapters: 16 },
  { order: 46, name: '1 Corinthians', aliases: ['1cor', '1co', '1 cor', '1st corinthians'], chapters: 16 },
  { order: 47, name: '2 Corinthians', aliases: ['2cor', '2co', '2 cor', '2nd corinthians'], chapters: 13 },
  { order: 48, name: 'Galatians', aliases: ['gal', 'ga'], chapters: 6 },
  { order: 49, name: 'Ephesians', aliases: ['eph', 'ephes'], chapters: 6 },
  { order: 50, name: 'Philippians', aliases: ['phil', 'php', 'pp'], chapters: 4 },
  { order: 51, name: 'Colossians', aliases: ['col', 'co'], chapters: 4 },
  { order: 52, name: '1 Thessalonians', aliases: ['1thess', '1th', '1 thess', '1st thessalonians'], chapters: 5 },
  { order: 53, name: '2 Thessalonians', aliases: ['2thess', '2th', '2 thess', '2nd thessalonians'], chapters: 3 },
  { order: 54, name: '1 Timothy', aliases: ['1tim', '1ti', '1 tim', '1st timothy'], chapters: 6 },
  { order: 55, name: '2 Timothy', aliases: ['2tim', '2ti', '2 tim', '2nd timothy'], chapters: 4 },
  { order: 56, name: 'Titus', aliases: ['tit', 'ti'], chapters: 3 },
  { order: 57, name: 'Philemon', aliases: ['philem', 'phm', 'pm'], chapters: 1 },
  { order: 58, name: 'Hebrews', aliases: ['heb', 'he'], chapters: 13 },
  { order: 59, name: 'James', aliases: ['jas', 'jm'], chapters: 5 },
  { order: 60, name: '1 Peter', aliases: ['1pet', '1pe', '1pt', '1p', '1 pet', '1st peter'], chapters: 5 },
  { order: 61, name: '2 Peter', aliases: ['2pet', '2pe', '2pt', '2p', '2 pet', '2nd peter'], chapters: 3 },
  { order: 62, name: '1 John', aliases: ['1john', '1jn', '1jo', '1j', '1 john', '1st john'], chapters: 5 },
  { order: 63, name: '2 John', aliases: ['2john', '2jn', '2jo', '2j', '2 john', '2nd john'], chapters: 1 },
  { order: 64, name: '3 John', aliases: ['3john', '3jn', '3jo', '3j', '3 john', '3rd john'], chapters: 1 },
  { order: 65, name: 'Jude', aliases: ['jud', 'jd'], chapters: 1 },
  { order: 66, name: 'Revelation', aliases: ['rev', 're', 'rv'], chapters: 22 },
];

export interface ParsedBibleReference {
  book: string;
  chapter: number;
  verse: number;
  hasExplicitVerse: boolean;
}

function normalizeBookToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveCanonicalBookName(rawBook: string): string | null {
  const normalized = normalizeBookToken(rawBook);
  if (!normalized) return null;
  const compact = normalized.replace(/\s+/g, '');

  for (const meta of BIBLE_CANON) {
    if (meta.name.toLowerCase() === normalized || meta.name.toLowerCase().replace(/\s+/g, '') === compact) {
      return meta.name;
    }
    for (const alias of meta.aliases) {
      if (alias === normalized || alias.replace(/\s+/g, '') === compact) {
        return meta.name;
      }
    }
  }

  const prefixMatch = BIBLE_CANON.find(
    (meta) =>
      meta.name.toLowerCase().startsWith(normalized) ||
      meta.name.toLowerCase().replace(/\s+/g, '').startsWith(compact)
  );
  return prefixMatch ? prefixMatch.name : null;
}

export function parseBibleReference(input: string): ParsedBibleReference | null {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;

  const match = cleaned.match(/^((?:[1-3]\s*)?[a-zA-Z\s]+?)\s+(\d+)(?:[:.\s]+(\d+)(?:-\d+)?)?$/);
  if (!match) {
    const bookOnly = resolveCanonicalBookName(cleaned);
    if (bookOnly) {
      return { book: bookOnly, chapter: 1, verse: 1, hasExplicitVerse: false };
    }
    return null;
  }

  const [, rawBook, rawChapter, rawVerse] = match;
  const book = resolveCanonicalBookName(rawBook);
  if (!book) return null;

  const chapter = Math.max(1, parseInt(rawChapter, 10));
  const hasExplicitVerse = Boolean(rawVerse);
  const verse = rawVerse ? Math.max(1, parseInt(rawVerse, 10)) : 1;

  return { book, chapter, verse, hasExplicitVerse };
}

export function getBookAutocompleteSuggestions(query: string, limit = 8): string[] {
  const q = normalizeBookToken(query);
  if (!q) return [];
  const compact = q.replace(/\s+/g, '');

  const parsed = parseBibleReference(query);
  const suggestions: string[] = [];
  if (parsed) {
    suggestions.push(`${parsed.book} ${parsed.chapter}:${parsed.verse}`);
  }

  for (const meta of BIBLE_CANON) {
    const nameNorm = meta.name.toLowerCase();
    const matches =
      nameNorm.includes(q) ||
      nameNorm.replace(/\s+/g, '').startsWith(compact) ||
      meta.aliases.some((a) => a.startsWith(q) || a.replace(/\s+/g, '').startsWith(compact));
    if (matches) {
      const candidate = `${meta.name} 1:1`;
      if (!suggestions.includes(candidate)) {
        suggestions.push(candidate);
      }
    }
    if (suggestions.length >= limit) break;
  }
  return suggestions.slice(0, limit);
}

export function findVerseInTranslation(
  translation: BibleTranslation | undefined,
  bookName: string,
  chapterNum: number,
  verseNum: number
): BibleVerse | null {
  if (!translation) return null;
  const canonical = resolveCanonicalBookName(bookName) || bookName;
  const book = translation.books.find(
    (b) => b.name.toLowerCase() === canonical.toLowerCase() || b.name.toLowerCase() === bookName.toLowerCase()
  );
  if (!book) return null;
  const chapter = book.chapters.find((c) => c.number === chapterNum);
  if (!chapter) return null;
  return chapter.verses.find((v) => v.number === verseNum) || null;
}

/**
 * Strictly constructs ONE Bible verse per slide.
 */
export function buildSingleVerseSlidePayload(
  primary: BibleTranslation,
  bookName: string,
  chapterNum: number,
  verseNum: number
): BibleSlidePayload | null {
  const verseObj = findVerseInTranslation(primary, bookName, chapterNum, verseNum);
  if (!verseObj) return null;

  const canonicalBook =
    primary.books.find(
      (b) =>
        b.name.toLowerCase() === (resolveCanonicalBookName(bookName) || bookName).toLowerCase()
    )?.name || bookName;

  return {
    translationId: primary.id,
    translationAbbr: primary.abbreviation,
    translationName: primary.name,
    book: canonicalBook,
    chapter: chapterNum,
    verse: verseNum,
    text: verseObj.text,
  };
}

export function sortTranslationsNltFirstNivSecond(translations: BibleTranslation[]): BibleTranslation[] {
  const priority = (abbr: string): number => {
    const upper = abbr.trim().toUpperCase();
    if (upper === 'NLT') return 0;
    if (upper === 'NIV') return 1;
    if (upper === 'KJV') return 2;
    return 10;
  };
  return [...translations].sort((a, b) => {
    const pa = priority(a.abbreviation);
    const pb = priority(b.abbreviation);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Strips any file path, source path, raw blob, or re-extraction metadata
 * so only extracted structured books/chapters/verses are persisted.
 */
export function sanitizeBibleTranslation(raw: BibleTranslation): BibleTranslation {
  return {
    id: String(raw.id),
    name: String(raw.name || 'Imported Bible').trim(),
    abbreviation: String(raw.abbreviation || 'BBL').trim().toUpperCase(),
    language: String(raw.language || 'English').trim(),
    isUserImported: Boolean(raw.isUserImported ?? true),
    importedAt: raw.importedAt || new Date().toISOString(),
    books: (raw.books || []).map((book) => ({
      name: String(book.name),
      order: book.order,
      chapters: (book.chapters || []).map((ch) => ({
        number: Number(ch.number),
        verses: (ch.verses || []).map((v) => ({
          number: Number(v.number),
          text: String(v.text),
        })),
      })),
    })),
  };
}

function inferAbbreviation(name: string): string {
  const upperWords = name.match(/\b[A-Z]{2,6}\b/g);
  if (upperWords && upperWords.length > 0) {
    return upperWords[upperWords.length - 1];
  }
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 5) || 'BBL'
  );
}

/**
 * Parses legacy backup Bible entries containing `parsedData`
 * (e.g. `{ id: "English NLT", name: "English NLT", parsedData: [{ title: "Genesis 1", content: "[Genesis 1]\n1 ..." }] }`)
 * into structured `BibleTranslation` without retaining any file path or raw source blob.
 */
export function parseLegacyBackupBible(raw: any): BibleTranslation | null {
  if (!raw || typeof raw !== 'object') return null;

  if (Array.isArray(raw.books)) {
    const cleanBooks: BibleBook[] = raw.books
      .filter((b: any) => b && typeof b.name === 'string' && Array.isArray(b.chapters))
      .map((b: any) => ({
        name: resolveCanonicalBookName(b.name) || b.name,
        order: typeof b.order === 'number' ? b.order : undefined,
        chapters: b.chapters
          .filter((c: any) => c && Array.isArray(c.verses))
          .map((c: any) => ({
            number: Number(c.number) || 1,
            verses: c.verses
              .filter((v: any) => v && Number.isFinite(Number(v.number)) && String(v.text || '').trim())
              .map((v: any) => ({ number: Number(v.number), text: String(v.text).trim() }))
              .sort((a: BibleVerse, b: BibleVerse) => a.number - b.number),
          }))
          .filter((c: BibleChapter) => c.verses.length > 0)
          .sort((a: BibleChapter, b: BibleChapter) => a.number - b.number),
      }))
      .filter((b: BibleBook) => b.chapters.length > 0);

    if (cleanBooks.length === 0) return null;

    const name = String(raw.name || raw.translation || 'Imported Bible').trim();
    const abbr = String(raw.abbreviation || raw.abbr || inferAbbreviation(name)).trim().toUpperCase();
    return sanitizeBibleTranslation({
      id: String(raw.id || `bible-${abbr.toLowerCase()}-${Date.now()}`),
      name,
      abbreviation: abbr,
      language: String(raw.language || 'English'),
      isUserImported: true,
      importedAt: new Date().toISOString(),
      books: cleanBooks,
    });
  }

  if (!Array.isArray(raw.parsedData)) return null;

  const bookMap = new Map<string, Map<number, BibleVerse[]>>();

  for (const entry of raw.parsedData) {
    if (!entry || typeof entry !== 'object') continue;
    let bookName = typeof entry.book === 'string' ? entry.book.trim() : '';
    let chapNum = entry.chapter ? parseInt(String(entry.chapter), 10) : NaN;

    if ((!bookName || Number.isNaN(chapNum)) && typeof entry.title === 'string') {
      const m = entry.title.trim().match(/^((?:[1-3]\s*)?[a-zA-Z\s]+?)\s+(\d+)$/);
      if (m) {
        bookName = bookName || m[1].trim();
        chapNum = Number.isNaN(chapNum) ? parseInt(m[2], 10) : chapNum;
      }
    }

    if (!bookName || Number.isNaN(chapNum) || chapNum < 1) continue;
    const canonical = resolveCanonicalBookName(bookName) || bookName;

    const content = typeof entry.content === 'string' ? entry.content : '';
    if (!content.trim()) continue;

    const lines = content.replace(/\r/g, '').split('\n');
    const verses: BibleVerse[] = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^\[.*\]$/.test(line)) continue; // skip [Genesis 1] header
      const vMatch = line.match(/^(\d+)\s+(.+)$/);
      if (vMatch) {
        verses.push({
          number: parseInt(vMatch[1], 10),
          text: vMatch[2].trim(),
        });
      } else if (verses.length > 0) {
        verses[verses.length - 1].text = `${verses[verses.length - 1].text} ${line}`;
      }
    }

    if (verses.length === 0) continue;

    if (!bookMap.has(canonical)) {
      bookMap.set(canonical, new Map());
    }
    const chapMap = bookMap.get(canonical)!;
    chapMap.set(
      chapNum,
      verses.sort((a, b) => a.number - b.number)
    );
  }

  if (bookMap.size === 0) return null;

  const canonOrder = new Map(BIBLE_CANON.map((b) => [b.name.toLowerCase(), b.order]));
  const books: BibleBook[] = Array.from(bookMap.entries())
    .map(([name, chapMap]) => ({
      name,
      order: canonOrder.get(name.toLowerCase()),
      chapters: Array.from(chapMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([number, verses]) => ({ number, verses })),
    }))
    .sort((a, b) => {
      const oa = a.order ?? 999;
      const ob = b.order ?? 999;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });

  const name = String(raw.name || raw.id || 'Imported Bible').trim();
  const abbr = String(raw.abbreviation || inferAbbreviation(name)).toUpperCase();

  return sanitizeBibleTranslation({
    id: String(raw.id || `bible-${abbr.toLowerCase()}-${Date.now()}`),
    name,
    abbreviation: abbr,
    language: String(raw.language || 'English'),
    isUserImported: true,
    importedAt: new Date().toISOString(),
    books,
  });
}

export interface BibleImportPreview {
  translation: BibleTranslation;
  stats: {
    bookCount: number;
    chapterCount: number;
    verseCount: number;
  };
  errors: string[];
}

function computeTranslationStats(books: BibleBook[]) {
  let chapterCount = 0;
  let verseCount = 0;
  for (const book of books) {
    chapterCount += book.chapters.length;
    for (const ch of book.chapters) {
      verseCount += ch.verses.length;
    }
  }
  return {
    bookCount: books.length,
    chapterCount,
    verseCount,
  };
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}

function getAttr(attrString: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
    const m = attrString.match(re);
    if (m) return (m[1] ?? m[2] ?? '').trim();
  }
  return undefined;
}

export function parseBibleXML(xmlText: string, fallbackName = 'Imported Bible'): BibleImportPreview {
  const errors: string[] = [];
  const trimmed = xmlText.trim();
  if (!trimmed || !trimmed.includes('<')) {
    return {
      translation: {
        id: `bible-${Date.now()}`,
        name: fallbackName,
        abbreviation: 'IMP',
        language: 'English',
        isUserImported: true,
        books: [],
      },
      stats: { bookCount: 0, chapterCount: 0, verseCount: 0 },
      errors: ['Input does not appear to be valid XML.'],
    };
  }

  const bibleTagMatch = trimmed.match(/<(?:bible|XMLBIBLE)\b([^>]*)>/i);
  const bibleAttrs = bibleTagMatch?.[1] || '';
  const transName =
    getAttr(bibleAttrs, ['translation', 'biblename', 'name', 'title']) || fallbackName;
  const transAbbr =
    getAttr(bibleAttrs, ['abbreviation', 'abbr', 'short', 'version']) ||
    transName
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 5) ||
    'XML';
  const language = getAttr(bibleAttrs, ['language', 'lang']) || 'English';

  const books: BibleBook[] = [];
  const bookRegex = /<(book|BIBLEBOOK|b)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let bookMatch: RegExpExecArray | null;

  while ((bookMatch = bookRegex.exec(trimmed)) !== null) {
    const attrs = bookMatch[2] || '';
    const innerBook = bookMatch[3] || '';
    const rawBookName = getAttr(attrs, ['name', 'bname', 'n', 'id']) || '';
    const bookNumRaw = getAttr(attrs, ['bnumber', 'number', 'num']);
    let bookName = resolveCanonicalBookName(rawBookName) || rawBookName;
    if (!bookName && bookNumRaw) {
      const idx = parseInt(bookNumRaw, 10);
      bookName = BIBLE_CANON.find((b) => b.order === idx)?.name || `Book ${idx}`;
    }
    if (!bookName) {
      errors.push('Encountered a <book> element without a name or number attribute.');
      continue;
    }

    const chapters: BibleChapter[] = [];
    const chapRegex = /<(chapter|CHAPTER|c)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let chapMatch: RegExpExecArray | null;
    while ((chapMatch = chapRegex.exec(innerBook)) !== null) {
      const cAttrs = chapMatch[2] || '';
      const innerChap = chapMatch[3] || '';
      const cNumRaw = getAttr(cAttrs, ['number', 'cnumber', 'n', 'id']) || '1';
      const cNum = parseInt(cNumRaw, 10);
      if (Number.isNaN(cNum) || cNum < 1) {
        errors.push(`Invalid chapter number "${cNumRaw}" in ${bookName}.`);
        continue;
      }

      const verses: BibleVerse[] = [];
      const verseRegex = /<(verse|VERS|v)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
      let verseMatch: RegExpExecArray | null;
      while ((verseMatch = verseRegex.exec(innerChap)) !== null) {
        const vAttrs = verseMatch[2] || '';
        const rawText = verseMatch[3].replace(/<[^>]+>/g, '');
        const vNumRaw = getAttr(vAttrs, ['number', 'vnumber', 'n', 'id']) || '1';
        const vNum = parseInt(vNumRaw, 10);
        const text = decodeXmlEntities(rawText);
        if (Number.isNaN(vNum) || vNum < 1) {
          errors.push(`Invalid verse number "${vNumRaw}" in ${bookName} ${cNum}.`);
          continue;
        }
        if (!text) {
          errors.push(`Empty verse text at ${bookName} ${cNum}:${vNum}.`);
          continue;
        }
        verses.push({ number: vNum, text });
      }

      if (verses.length > 0) {
        chapters.push({ number: cNum, verses: verses.sort((a, b) => a.number - b.number) });
      }
    }

    if (chapters.length > 0) {
      books.push({ name: bookName, chapters: chapters.sort((a, b) => a.number - b.number) });
    }
  }

  if (books.length === 0) {
    errors.push('No <book>, <chapter>, or <verse> nodes were recognized in the XML file.');
  }

  const translation = sanitizeBibleTranslation({
    id: `bible-${transAbbr.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`,
    name: transName,
    abbreviation: transAbbr.toUpperCase(),
    language,
    isUserImported: true,
    importedAt: new Date().toISOString(),
    books,
  });

  return {
    translation,
    stats: computeTranslationStats(books),
    errors,
  };
}

export function parseBibleJSON(jsonText: string, fallbackName = 'Imported Bible'): BibleImportPreview {
  const errors: string[] = [];
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return {
      translation: {
        id: `bible-${Date.now()}`,
        name: fallbackName,
        abbreviation: 'IMP',
        language: 'English',
        isUserImported: true,
        books: [],
      },
      stats: { bookCount: 0, chapterCount: 0, verseCount: 0 },
      errors: [`Invalid JSON syntax: ${err instanceof Error ? err.message : 'Unable to parse'}`],
    };
  }

  // Also support legacy parsedData Bible JSON directly
  if (Array.isArray(parsed?.parsedData)) {
    const legacy = parseLegacyBackupBible(parsed);
    if (legacy) {
      return {
        translation: legacy,
        stats: computeTranslationStats(legacy.books),
        errors: [],
      };
    }
  }

  const transName = String(parsed?.translation || parsed?.name || fallbackName).trim();
  const transAbbr = String(
    parsed?.abbreviation ||
      parsed?.abbr ||
      transName
        .split(/\s+/)
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 5) ||
      'JSON'
  )
    .trim()
    .toUpperCase();
  const language = String(parsed?.language || 'English').trim();

  const books: BibleBook[] = [];
  if (!Array.isArray(parsed?.books)) {
    errors.push('JSON must contain a "books" array.');
  } else {
    for (const rawBook of parsed.books) {
      const bookNameRaw = String(rawBook?.name || '').trim();
      if (!bookNameRaw) {
        errors.push('Skipped a book entry missing a "name" field.');
        continue;
      }
      const bookName = resolveCanonicalBookName(bookNameRaw) || bookNameRaw;
      if (!Array.isArray(rawBook?.chapters)) {
        errors.push(`Book "${bookName}" is missing a "chapters" array.`);
        continue;
      }
      const chapters: BibleChapter[] = [];
      for (const rawChap of rawBook.chapters) {
        const chapNum = Number(rawChap?.number);
        if (!Number.isFinite(chapNum) || chapNum < 1) {
          errors.push(`Invalid chapter number in ${bookName}.`);
          continue;
        }
        if (!Array.isArray(rawChap?.verses)) {
          errors.push(`${bookName} ${chapNum} is missing a "verses" array.`);
          continue;
        }
        const verses: BibleVerse[] = [];
        for (const rawVerse of rawChap.verses) {
          const vNum = Number(rawVerse?.number);
          const text = String(rawVerse?.text || '').trim();
          if (!Number.isFinite(vNum) || vNum < 1 || !text) {
            errors.push(`Invalid verse entry in ${bookName} ${chapNum}.`);
            continue;
          }
          verses.push({ number: vNum, text });
        }
        if (verses.length > 0) {
          chapters.push({ number: chapNum, verses: verses.sort((a, b) => a.number - b.number) });
        }
      }
      if (chapters.length > 0) {
        books.push({ name: bookName, chapters: chapters.sort((a, b) => a.number - b.number) });
      }
    }
  }

  if (books.length === 0 && errors.length === 0) {
    errors.push('No valid books or verses found in JSON.');
  }

  const translation = sanitizeBibleTranslation({
    id: `bible-${transAbbr.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`,
    name: transName,
    abbreviation: transAbbr,
    language,
    isUserImported: true,
    importedAt: new Date().toISOString(),
    books,
  });

  return {
    translation,
    stats: computeTranslationStats(books),
    errors,
  };
}

function splitCsvRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseBibleCSV(csvText: string, fallbackName = 'Imported CSV Bible'): BibleImportPreview {
  const errors: string[] = [];
  const lines = csvText
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      translation: {
        id: `bible-${Date.now()}`,
        name: fallbackName,
        abbreviation: 'CSV',
        language: 'English',
        isUserImported: true,
        books: [],
      },
      stats: { bookCount: 0, chapterCount: 0, verseCount: 0 },
      errors: ['CSV file is empty.'],
    };
  }

  const firstCols = splitCsvRow(lines[0]).map((c) => c.toLowerCase());
  const hasHeader =
    firstCols.includes('book') && firstCols.includes('chapter') && firstCols.includes('verse');

  let bookIdx = 0;
  let chapIdx = 1;
  let verseIdx = 2;
  let textIdx = 3;
  let transIdx = -1;

  if (hasHeader) {
    transIdx = firstCols.indexOf('translation');
    bookIdx = firstCols.indexOf('book');
    chapIdx = firstCols.indexOf('chapter');
    verseIdx = firstCols.indexOf('verse');
    textIdx = firstCols.indexOf('text');
    if (textIdx === -1) textIdx = firstCols.length - 1;
  } else if (firstCols.length >= 5 && Number.isNaN(Number(firstCols[1]))) {
    transIdx = 0;
    bookIdx = 1;
    chapIdx = 2;
    verseIdx = 3;
    textIdx = 4;
  }

  const bookMap = new Map<string, Map<number, BibleVerse[]>>();
  let detectedTranslation = '';

  const startRow = hasHeader ? 1 : 0;
  for (let i = startRow; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.length < 4) {
      errors.push(`Row ${i + 1}: expected at least 4 columns (Book, Chapter, Verse, Text).`);
      continue;
    }
    if (transIdx >= 0 && cols[transIdx] && !detectedTranslation) {
      detectedTranslation = cols[transIdx];
    }
    const rawBook = cols[bookIdx] || '';
    const bookName = resolveCanonicalBookName(rawBook) || rawBook;
    const chapNum = parseInt(cols[chapIdx], 10);
    const verseNum = parseInt(cols[verseIdx], 10);
    const text = cols.slice(textIdx).join(', ').trim();

    if (!bookName || Number.isNaN(chapNum) || Number.isNaN(verseNum) || !text) {
      errors.push(`Row ${i + 1}: invalid book/chapter/verse or empty text.`);
      continue;
    }

    if (!bookMap.has(bookName)) {
      bookMap.set(bookName, new Map());
    }
    const chapMap = bookMap.get(bookName)!;
    if (!chapMap.has(chapNum)) {
      chapMap.set(chapNum, []);
    }
    chapMap.get(chapNum)!.push({ number: verseNum, text });
  }

  const books: BibleBook[] = [];
  for (const [name, chapMap] of bookMap.entries()) {
    const chapters: BibleChapter[] = [];
    for (const [number, verses] of Array.from(chapMap.entries()).sort((a, b) => a[0] - b[0])) {
      chapters.push({ number, verses: verses.sort((a, b) => a.number - b.number) });
    }
    books.push({ name, chapters });
  }

  if (books.length === 0) {
    errors.push('No valid verses could be parsed from the CSV file.');
  }

  const name = detectedTranslation || fallbackName;
  const abbr =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 5) || 'CSV';

  const translation = sanitizeBibleTranslation({
    id: `bible-${abbr.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`,
    name,
    abbreviation: abbr,
    language: 'English',
    isUserImported: true,
    importedAt: new Date().toISOString(),
    books,
  });

  return {
    translation,
    stats: computeTranslationStats(books),
    errors,
  };
}
