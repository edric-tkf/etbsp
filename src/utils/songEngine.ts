import type { Song, SongSection, SongSectionType, SongSlide } from '../types/models';

export const MAX_LINES_PER_SONG_SLIDE = 2;

const BRACKET_HEADING_REGEX = /^\[([^\]]+)\]\s*:?\s*$/;
const SECTION_HEADING_REGEX =
  /^\[?\s*(verse(?:\s+\d+)?|chorus(?:\s+\d+)?|pre[\s-]?chorus(?:\s+\d+)?|bridge(?:\s+\d+)?|intro(?:\s+\d+)?|outro(?:\s+\d+)?|tag(?:\s+\d+)?|ending(?:\s+\d+)?|refrain(?:\s+\d+)?|interlude(?:\s+\d+)?|vamp(?:\s+\d+)?|instrumental(?:\s+\d+)?|v\d+|c\d+|b\d+)\s*(?:\]|:)?\s*$/i;

export function inferSectionType(heading: string): SongSectionType {
  const lower = heading.toLowerCase().trim();
  if (lower.startsWith('pre-chorus') || lower.startsWith('pre chorus') || lower.startsWith('prechorus')) {
    return 'pre-chorus';
  }
  if (lower.startsWith('chorus') || lower.startsWith('refrain') || /^c\d+$/i.test(lower)) return 'chorus';
  if (lower.startsWith('bridge') || /^b\d+$/i.test(lower)) return 'bridge';
  if (lower.startsWith('intro')) return 'intro';
  if (lower.startsWith('outro')) return 'outro';
  if (lower.startsWith('tag')) return 'tag';
  if (lower.startsWith('ending')) return 'ending';
  if (lower.startsWith('verse') || /^v\d+$/i.test(lower)) return 'verse';
  return 'other';
}

function normalizeSectionHeading(raw: string): string {
  const cleaned = raw.replace(/^\[|\]$/g, '').replace(/:$/, '').trim();
  const lower = cleaned.toLowerCase();
  if (/^v(\d+)$/.test(lower)) return `Verse ${lower.slice(1)}`;
  if (/^c(\d+)$/.test(lower)) return `Chorus ${lower.slice(1)}`;
  if (/^b(\d+)$/.test(lower)) return `Bridge ${lower.slice(1)}`;
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

function isSectionHeading(line: string): boolean {
  return BRACKET_HEADING_REGEX.test(line) || SECTION_HEADING_REGEX.test(line);
}

/**
 * Splits non-empty lyric lines into slides of strictly TWO lyric lines per slide
 * (with at most 1 remainder line on the final slide if the section has an odd line count).
 */
export function groupLinesIntoTwoLineSlides(
  lines: string[],
  section: { id: string; title: string; type: SongSectionType; timestamps?: Array<number | undefined> },
  songId: string
): Omit<SongSlide, 'slideIndex' | 'totalSlides'>[] {
  const cleanIndices: number[] = [];
  const cleanLines: string[] = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      cleanLines.push(trimmed);
      cleanIndices.push(idx);
    }
  });

  const slides: Omit<SongSlide, 'slideIndex' | 'totalSlides'>[] = [];
  for (let i = 0; i < cleanLines.length; i += MAX_LINES_PER_SONG_SLIDE) {
    const pair = cleanLines.slice(i, i + MAX_LINES_PER_SONG_SLIDE);
    const firstOrigIdx = cleanIndices[i];
    const ts = section.timestamps?.[firstOrigIdx];
    slides.push({
      id: `${songId}-${section.id}-${Math.floor(i / 2)}`,
      songId,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionType: section.type,
      lines: pair,
      timestamp: ts,
    });
  }
  return slides;
}

export function computeSongSlides(song: Song): SongSlide[] {
  const rawSlides: Omit<SongSlide, 'slideIndex' | 'totalSlides'>[] = [];
  for (const section of song.sections) {
    rawSlides.push(...groupLinesIntoTwoLineSlides(section.lyrics, section, song.id));
  }
  const totalSlides = rawSlides.length;
  return rawSlides.map((slide, idx) => ({
    ...slide,
    slideIndex: idx,
    totalSlides,
  }));
}

export function sortSongsAlphabetically(songs: Song[]): Song[] {
  return [...songs].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true })
  );
}

export function songToRawText(song: Song): string {
  if (typeof song.rawText === 'string' && song.rawText.trim().length > 0) {
    return song.rawText.trim();
  }
  return song.sections
    .map((sec) => `[${sec.title}]\n${sec.lyrics.join('\n')}`)
    .join('\n\n');
}

export interface SongImportPreview {
  song: Song;
  slideCount: number;
  warnings: string[];
  errors: string[];
}

export function parseSongTXT(
  text: string,
  meta?: { id?: string; title?: string; artist?: string; author?: string; language?: string; createdAt?: string; updatedAt?: string }
): SongImportPreview {
  const warnings: string[] = [];
  const errors: string[] = [];
  const normalized = text.replace(/\r/g, '').trim();

  if (!normalized) {
    const now = new Date().toISOString();
    const emptySong: Song = {
      id: meta?.id || `song-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: meta?.title?.trim() || 'Untitled Song',
      artist: meta?.artist?.trim() || '',
      author: meta?.author?.trim() || undefined,
      language: meta?.language?.trim() || 'English',
      rawText: '',
      sections: [],
      createdAt: meta?.createdAt || now,
      updatedAt: meta?.updatedAt || now,
    };
    return { song: emptySong, slideCount: 0, warnings, errors: ['No lyric lines provided.'] };
  }

  const rawLines = normalized.split('\n');
  const sections: SongSection[] = [];
  let currentTitle = 'Verse 1';
  let currentType: SongSectionType = 'verse';
  let currentLyrics: string[] = [];
  let verseCounter = 1;
  let sawAnyHeading = false;

  const flushSection = () => {
    const nonEmpty = currentLyrics.map((l) => l.trim()).filter(Boolean);
    if (nonEmpty.length > 0) {
      sections.push({
        id: `sec-${sections.length + 1}-${Date.now()}`,
        type: currentType,
        title: currentTitle,
        lyrics: nonEmpty,
      });
    }
    currentLyrics = [];
  };

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) {
      if (!sawAnyHeading && currentLyrics.length > 0) {
        flushSection();
        verseCounter += 1;
        currentTitle = `Verse ${verseCounter}`;
        currentType = 'verse';
      }
      continue;
    }

    if (isSectionHeading(line)) {
      sawAnyHeading = true;
      flushSection();
      currentTitle = normalizeSectionHeading(line);
      currentType = inferSectionType(currentTitle);
      continue;
    }

    currentLyrics.push(line);
  }
  flushSection();

  if (!sawAnyHeading && sections.length > 1) {
    const mergedLyrics = sections.flatMap((s) => s.lyrics);
    sections.splice(0, sections.length, {
      id: `sec-1-${Date.now()}`,
      type: 'verse',
      title: 'Verse 1',
      lyrics: mergedLyrics,
    });
  } else if (!sawAnyHeading && sections.length === 1) {
    sections[0].title = 'Verse 1';
  }

  if (sections.length === 0) {
    errors.push('No non-empty lyric lines were found.');
  }

  const now = new Date().toISOString();
  const song: Song = {
    id: meta?.id || `song-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: meta?.title?.trim() || 'Untitled Song',
    artist: meta?.artist?.trim() || '',
    author: meta?.author?.trim() || undefined,
    language: meta?.language?.trim() || 'English',
    rawText: normalized,
    sections,
    createdAt: meta?.createdAt || now,
    updatedAt: meta?.updatedAt || now,
  };

  const slides = computeSongSlides(song);
  return { song, slideCount: slides.length, warnings, errors };
}

function toIsoDate(val: unknown): string {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return new Date(val).toISOString();
  }
  if (typeof val === 'string' && val.trim()) {
    const parsed = Date.parse(val);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Parses a song entry from either ET BSP backups or legacy Bible Song Pro backups
 * where songs have `text` and/or `normalizedLines` instead of `sections`.
 */
export function parseLegacyBackupSong(raw: any): Song | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = String(raw.id || `song-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).trim();
  const title = String(raw.title || 'Untitled Song').trim() || 'Untitled Song';
  const createdAt = toIsoDate(raw.createdAt);
  const updatedAt = toIsoDate(raw.updatedAt);

  if (Array.isArray(raw.sections) && raw.sections.length > 0) {
    const sections: SongSection[] = raw.sections
      .map((sec: any, idx: number): SongSection | null => {
        const lyrics = Array.isArray(sec?.lyrics)
          ? sec.lyrics.map((l: unknown) => String(l).trim()).filter(Boolean)
          : [];
        if (lyrics.length === 0) return null;
        const secTitle = String(sec?.title || `Section ${idx + 1}`).trim();
        return {
          id: String(sec?.id || `sec-${idx + 1}-${Date.now()}`),
          type: sec?.type || inferSectionType(secTitle),
          title: secTitle,
          lyrics,
          timestamps: Array.isArray(sec?.timestamps) ? sec.timestamps : undefined,
        };
      })
      .filter((s: SongSection | null): s is SongSection => s !== null);

    if (sections.length > 0) {
      return {
        id,
        title,
        artist: typeof raw.artist === 'string' ? raw.artist : '',
        author: typeof raw.author === 'string' ? raw.author : undefined,
        language: typeof raw.language === 'string' ? raw.language : 'English',
        rawText: typeof raw.rawText === 'string' ? raw.rawText : undefined,
        sections,
        createdAt,
        updatedAt,
      };
    }
  }

  const rawText =
    typeof raw.text === 'string' && raw.text.trim().length > 0
      ? raw.text
      : Array.isArray(raw.normalizedLines)
      ? raw.normalizedLines.map((l: unknown) => String(l ?? '')).join('\n')
      : '';

  if (!rawText.trim()) return null;

  const parsed = parseSongTXT(rawText, {
    id,
    title,
    artist: typeof raw.artist === 'string' ? raw.artist : '',
    author: typeof raw.author === 'string' ? raw.author : undefined,
    language: typeof raw.language === 'string' ? raw.language : 'English',
    createdAt,
    updatedAt,
  });

  if (parsed.song.sections.length === 0) return null;
  return parsed.song;
}

export function formatTimestamp(seconds?: number): string {
  if (seconds === undefined || Number.isNaN(seconds)) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
