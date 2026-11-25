import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildSingleVerseSlidePayload,
  getBookAutocompleteSuggestions,
  parseBibleCSV,
  parseBibleJSON,
  parseBibleReference,
  parseBibleXML,
  sanitizeBibleTranslation,
  sortTranslationsNltFirstNivSecond,
} from '../utils/bibleEngine';
import {
  computeSongSlides,
  parseSongTXT,
  songToRawText,
  sortSongsAlphabetically,
} from '../utils/songEngine';
import {
  createBackupFile,
  mergeBackupData,
  replaceBackupData,
  validateBackupFile,
} from '../utils/backupEngine';
import { normalizeFontFamilyName } from '../utils/fontEngine';
import {
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_USER_PREFERENCES,
  SEED_BIBLE_TRANSLATIONS,
  SEED_SONGS,
  normalizeDisplaySettings,
} from '../data/seedData';
import { PresentationSyncClient } from '../utils/syncEngine';
import type { BibleTranslation, Song } from '../types/models';

const sampleNlt: BibleTranslation = {
  id: 'nlt',
  name: 'New Living Translation',
  abbreviation: 'NLT',
  language: 'English',
  isUserImported: true,
  books: [
    {
      name: 'Genesis',
      order: 1,
      chapters: [
        {
          number: 1,
          verses: [
            { number: 1, text: 'In the beginning God created the heavens and the earth.' },
          ],
        },
      ],
    },
    {
      name: 'John',
      order: 43,
      chapters: [
        {
          number: 3,
          verses: [
            { number: 16, text: 'For this is how God loved the world.' },
          ],
        },
      ],
    },
  ],
};

const sampleNiv: BibleTranslation = {
  id: 'niv',
  name: 'New International Version',
  abbreviation: 'NIV',
  language: 'English',
  isUserImported: true,
  books: [
    {
      name: 'John',
      order: 43,
      chapters: [
        {
          number: 3,
          verses: [
            { number: 16, text: 'For God so loved the world that he gave his one and only Son.' },
          ],
        },
      ],
    },
  ],
};

const sampleSong: Song = {
  id: 'song_abide',
  title: 'Abide',
  rawText: '[Verse 1]\nFor my waking breath\nFor my daily bread\n\n[Chorus]\nI depend on You\nI depend on You',
  sections: [
    {
      id: 'sec-1',
      type: 'verse',
      title: 'Verse 1',
      lyrics: ['For my waking breath', 'For my daily bread'],
    },
    {
      id: 'sec-2',
      type: 'chorus',
      title: 'Chorus',
      lyrics: ['I depend on You', 'I depend on You'],
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Seed Policy & Empty Initial Library', () => {
  it('ships with zero placeholder songs or placeholder Bible versions', () => {
    expect(SEED_BIBLE_TRANSLATIONS).toHaveLength(0);
    expect(SEED_SONGS).toHaveLength(0);
  });
});

describe('Bible Reference Parsing, Sanitization & Ordering', () => {
  it('places NLT first and NIV second', () => {
    const sorted = sortTranslationsNltFirstNivSecond([sampleNiv, sampleNlt]);
    expect(sorted[0].abbreviation).toBe('NLT');
    expect(sorted[1].abbreviation).toBe('NIV');
  });

  it('parses abbreviated and full Bible references cleanly', () => {
    expect(parseBibleReference('Gen 1:1')).toEqual({
      book: 'Genesis',
      chapter: 1,
      verse: 1,
      hasExplicitVerse: true,
    });
    expect(parseBibleReference('John 3:16')).toEqual({
      book: 'John',
      chapter: 3,
      verse: 16,
      hasExplicitVerse: true,
    });
    expect(parseBibleReference('1 Cor 13:4')).toEqual({
      book: '1 Corinthians',
      chapter: 13,
      verse: 4,
      hasExplicitVerse: true,
    });
    expect(parseBibleReference('Psalm 23')).toEqual({
      book: 'Psalms',
      chapter: 23,
      verse: 1,
      hasExplicitVerse: false,
    });
  });

  it('generates autocomplete suggestions for partial references', () => {
    const suggestions = getBookAutocompleteSuggestions('Gen 1');
    expect(suggestions[0]).toBe('Genesis 1:1');
  });

  it('strictly builds single-verse slide payload without dual Bible fields', () => {
    const single = buildSingleVerseSlidePayload(sampleNlt, 'Genesis', 1, 1);
    expect(single).not.toBeNull();
    expect(single?.verse).toBe(1);
    expect(single?.text).toContain('In the beginning');
    expect((single as any).dualEnabled).toBeUndefined();
  });

  it('strips any file path or re-extraction metadata when sanitizing translations', () => {
    const dirty = {
      ...sampleNlt,
      filePath: '/Users/church/bibles/nlt.xml',
      sourcePath: 'C:\\Bibles\\nlt.xml',
      rawContent: '<bible>...</bible>',
    } as BibleTranslation & Record<string, unknown>;

    const clean = sanitizeBibleTranslation(dirty);
    expect((clean as any).filePath).toBeUndefined();
    expect((clean as any).sourcePath).toBeUndefined();
    expect((clean as any).rawContent).toBeUndefined();
    expect(clean.books).toHaveLength(2);
  });
});

describe('Bible Importers (XML, JSON, CSV)', () => {
  it('imports Bible XML files accurately', () => {
    const xml = `<bible translation="Berean Standard Bible" abbreviation="BSB" language="English">
      <book name="Genesis">
        <chapter number="1">
          <verse number="1">In the beginning God created the heavens and the earth.</verse>
          <verse number="2">Now the earth was formless and void.</verse>
        </chapter>
      </book>
    </bible>`;
    const result = parseBibleXML(xml);
    expect(result.errors).toHaveLength(0);
    expect(result.translation.name).toBe('Berean Standard Bible');
    expect(result.translation.abbreviation).toBe('BSB');
    expect(result.stats).toEqual({ bookCount: 1, chapterCount: 1, verseCount: 2 });
  });

  it('imports Bible JSON files matching the required schema', () => {
    const json = JSON.stringify({
      translation: 'Example Translation',
      abbreviation: 'EXT',
      language: 'English',
      books: [
        {
          name: 'Genesis',
          chapters: [
            {
              number: 1,
              verses: [{ number: 1, text: 'In the beginning...' }],
            },
          ],
        },
      ],
    });
    const result = parseBibleJSON(json);
    expect(result.errors).toHaveLength(0);
    expect(result.translation.abbreviation).toBe('EXT');
    expect(result.stats.verseCount).toBe(1);
  });

  it('imports Bible CSV files accurately', () => {
    const csv = `Translation,Book,Chapter,Verse,Text
World English Bible,John,3,16,"For God so loved the world..."`;
    const result = parseBibleCSV(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.translation.books[0].name).toBe('John');
    expect(result.stats.verseCount).toBe(1);
  });
});

describe('Single-Field Song Parsing, 2-Line Slides & Alphabetical Sorting', () => {
  it('parses bracketed section format including arbitrary tags like [PRE CHORUS] into 2-line slides', () => {
    const txt = `[Verse 1]
Line one
Line two
Line three
Line four

[PRE CHORUS]
Pre chorus one
Pre chorus two

[Chorus]
Chorus one
Chorus two`;
    const parsed = parseSongTXT(txt, { title: 'Test Song' });
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.song.sections).toHaveLength(3);
    expect(parsed.song.sections[1].type).toBe('pre-chorus');
    const slides = computeSongSlides(parsed.song);
    expect(slides).toHaveLength(4);
    expect(slides[0].lines).toEqual(['Line one', 'Line two']);
    expect(slides[1].lines).toEqual(['Line three', 'Line four']);
    expect(slides[2].lines).toEqual(['Pre chorus one', 'Pre chorus two']);
    expect(slides[3].lines).toEqual(['Chorus one', 'Chorus two']);
  });

  it('starts a new slide on intentional blank lines within a section without merging across the break', () => {
    const txt = `[Verse 1]
A
B
C

D
E
F`;
    const parsed = parseSongTXT(txt, { title: 'Break Test' });
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.song.sections).toHaveLength(1);
    const slides = computeSongSlides(parsed.song);
    expect(slides.map((s) => s.lines)).toEqual([
      ['A', 'B'],
      ['C'],
      ['D', 'E'],
      ['F'],
    ]);
    expect(songToRawText(parsed.song)).toContain('C\n\nD');
  });

  it('reconstructs raw editable text via songToRawText', () => {
    const raw = songToRawText(sampleSong);
    expect(raw).toContain('[Verse 1]');
    expect(raw).toContain('[Chorus]');
  });

  it('sorts songs alphabetically by title', () => {
    const sorted = sortSongsAlphabetically([
      { ...sampleSong, id: '3', title: 'Way Maker' },
      { ...sampleSong, id: '1', title: 'Abide' },
      { ...sampleSong, id: '2', title: 'Goodness of God' },
    ]);
    expect(sorted.map((s) => s.title)).toEqual(['Abide', 'Goodness of God', 'Way Maker']);
  });
});

describe('Backup Export, Validation & Legacy Bible Song Pro Compatibility', () => {
  it('creates, validates, merges, and replaces ET BSP backups without requiring setlists', () => {
    const backup = createBackupFile({
      songs: [sampleSong],
      bibleTranslations: [sampleNlt],
      customFonts: [{ id: 'f1', name: 'Geist Bold', dataUrl: 'data:font/ttf;base64,AAAA' }],
      settings: DEFAULT_DISPLAY_SETTINGS,
      themes: DEFAULT_THEME_SETTINGS,
      preferences: DEFAULT_USER_PREFERENCES,
    });
    expect(backup.app).toBe('ET BSP');
    expect(backup.schemaVersion).toBe(1);

    const validated = validateBackupFile(JSON.stringify(backup));
    expect(validated.valid).toBe(true);
    expect(validated.preview?.songCount).toBe(1);
    expect(validated.preview?.translationCount).toBe(1);
    expect(validated.preview?.fontCount).toBe(1);

    const invalid = validateBackupFile('{"app":"OtherApp"}');
    expect(invalid.valid).toBe(false);

    const extraSong: Song = { ...sampleSong, id: 'song-extra', title: 'Blessed Assurance' };
    const existingBundle = {
      songs: [sampleSong],
      bibleTranslations: [sampleNlt],
      customFonts: [],
      settings: DEFAULT_DISPLAY_SETTINGS,
      themes: DEFAULT_THEME_SETTINGS,
      preferences: DEFAULT_USER_PREFERENCES,
    };

    const merged = mergeBackupData(existingBundle, { ...backup, songs: [extraSong] });
    expect(merged.songs.map((s) => s.title)).toEqual(['Abide', 'Blessed Assurance']);

    const replaced = replaceBackupData(existingBundle, { ...backup, songs: [extraSong] });
    expect(replaced.songs).toHaveLength(1);
    expect(replaced.songs[0].id).toBe('song-extra');
  });

  it('imports legacy BibleSongPro backup shape (backupVersion + data.{songs, bibles, customFonts, settings})', () => {
    const legacyPayload = {
      app: 'Bible Song Pro',
      backupVersion: 1,
      exportedAt: '2026-07-16T18:47:00.000Z',
      data: {
        songs: [
          {
            id: 'song_abide_fyxbzp',
            title: 'Abide',
            text: '',
            normalizedLines: [
              '[Verse 1]',
              'For my waking breath for my daily bread',
              '',
              '[Chorus]',
              "You're the way the truth and the life",
              '',
              '[Tag]',
              'I depend on You',
            ],
          },
        ],
        bibles: [
          {
            id: 'English NLT',
            name: 'English NLT',
            filePath: 'C:/should/not/persist.xml',
            parsedData: [
              {
                title: 'Genesis 1',
                book: 'Genesis',
                chapter: 1,
                content: '[Genesis 1]\n1 In the beginning God created the heavens and the earth.',
              },
            ],
          },
        ],
        customFonts: [
          { id: 'font_1', name: 'Geist-Bold', dataUrl: 'data:font/ttf;base64,AAE=' },
        ],
        settings: {
          fontFamily: "'Geist-Bold',sans-serif",
          ltAnchorMode: 'top',
          refBgColor: '#facc15',
          refColor: '#11141a',
        },
      },
    };

    const res = validateBackupFile(JSON.stringify(legacyPayload));
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.backup?.songs).toHaveLength(1);
    expect(res.backup?.songs[0].sections).toHaveLength(3);
    expect(res.backup?.bibleTranslations).toHaveLength(1);
    expect(res.backup?.bibleTranslations[0].abbreviation).toBe('NLT');
    expect((res.backup?.bibleTranslations[0] as any).filePath).toBeUndefined();
    expect(res.backup?.customFonts).toHaveLength(1);
    expect(res.backup?.settings?.fontFamily).toBe('Geist-Bold');
    expect(res.backup?.settings?.lowerThirdPosition).toBe('top');
  });

  it('validates the bundled real backup file without errors', () => {
    const sampleBackupPath = path.resolve(
      process.cwd(),
      'public/assets/aistudio/BibleSongPro_Backup_2026-07-16_1847_9a90475a.json'
    );
    if (fs.existsSync(sampleBackupPath)) {
      const raw = fs.readFileSync(sampleBackupPath, 'utf8');
      const res = validateBackupFile(raw);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.backup?.songs.length).toBeGreaterThan(0);
      expect(res.backup?.bibleTranslations.length).toBeGreaterThan(0);
    }
  });
});

describe('Font Engine & Panel/Display Sync', () => {
  it('normalizes CSS font-family strings cleanly', () => {
    expect(normalizeFontFamilyName("'Geist-Bold',sans-serif")).toBe('Geist-Bold');
    expect(normalizeFontFamilyName('"Plus Jakarta Sans"')).toBe('Plus Jakarta Sans');
  });

  it('synchronizes presentation and custom fonts updates via BroadcastChannel', () => {
    const channels: any[] = [];
    class MockBroadcastChannel {
      name: string;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      constructor(name: string) {
        this.name = name;
        channels.push(this);
      }
      postMessage(data: unknown) {
        for (const ch of channels) {
          if (ch !== this && ch.name === this.name && ch.onmessage) {
            ch.onmessage({ data } as MessageEvent);
          }
        }
      }
      close() {}
    }

    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

    const receivedPres: any[] = [];
    const receivedFonts: any[] = [];
    const displayClient = new PresentationSyncClient('display', {
      onPresentationUpdate: (state) => receivedPres.push(state),
      onFontsUpdate: (fonts) => receivedFonts.push(fonts),
    });
    const panelClient = new PresentationSyncClient('panel', {});

    panelClient.publishPresentation({
      isLive: true,
      activeType: 'bible',
      bibleDisplayMode: 'lower-third',
      bible: {
        translationId: 'nlt',
        translationAbbr: 'NLT',
        translationName: 'New Living Translation',
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        text: 'In the beginning God created the heavens and the earth.',
      },
      updatedAt: Date.now(),
      revision: 1,
    });

    panelClient.publishFonts([
      { id: 'f-1', name: 'MyCustomFont', dataUrl: 'data:font/woff2;base64,AAAA' },
    ]);

    expect(receivedPres).toHaveLength(1);
    expect(receivedPres[0].bibleDisplayMode).toBe('lower-third');
    expect(receivedPres[0].bible.book).toBe('Genesis');
    expect(receivedFonts).toHaveLength(1);
    expect(receivedFonts[0][0].name).toBe('MyCustomFont');

    panelClient.dispose();
    displayClient.dispose();
    vi.unstubAllGlobals();
  });
});

describe('Fixed Pixel Font Sizes & Lower Layout Minimums', () => {
  it('provides separate fixed px defaults for Full-Screen and Lower-Third and migrates legacy fontSizeScale', () => {
    expect(DEFAULT_DISPLAY_SETTINGS.fullscreenFontSizePx).toBe(64);
    expect(DEFAULT_DISPLAY_SETTINGS.lowerThirdFontSizePx).toBe(42);

    const migrated = normalizeDisplaySettings({
      fontSizeScale: 1.5,
      safeMarginPercent: 0,
      lowerThirdHeightPercent: 5,
    });
    expect(migrated.fullscreenFontSizePx).toBe(96);
    expect(migrated.lowerThirdFontSizePx).toBe(63);
    expect(migrated.safeMarginPercent).toBe(0);
    expect(migrated.lowerThirdHeightPercent).toBe(5);

    const explicit = normalizeDisplaySettings({
      fullscreenFontSizePx: 52,
      lowerThirdFontSizePx: 30,
      fontSizeScale: 1.5,
      textPaddingLeftPx: 48,
      textPaddingRightPx: 64,
    });
    expect(explicit.fullscreenFontSizePx).toBe(52);
    expect(explicit.lowerThirdFontSizePx).toBe(30);
    expect(explicit.textPaddingLeftPx).toBe(48);
    expect(explicit.textPaddingRightPx).toBe(64);
    expect(DEFAULT_DISPLAY_SETTINGS.textPaddingLeftPx).toBe(0);
    expect(DEFAULT_DISPLAY_SETTINGS.textPaddingRightPx).toBe(0);
    expect(DEFAULT_USER_PREFERENCES.uiFontSizePx).toBe(14.5);
    expect(DEFAULT_USER_PREFERENCES.uiRowHeightPx).toBe(54);
    expect(DEFAULT_USER_PREFERENCES.songbookAutoMerge).toBe(false);
  });
});

import { isAllowedSongbookEmail } from '../firebase/firebaseClients';
import { parseSongbookDocToSong, reconcileSongbookMerge } from '../utils/songbookSync';

describe('ET OAuth Allowlist & Songbook Two-Way Merge', () => {
  it('allows only edric.tkf@gmail.com and edricteo@et.com case-insensitively', () => {
    expect(isAllowedSongbookEmail('edric.tkf@gmail.com')).toBe(true);
    expect(isAllowedSongbookEmail('  EDRICTEO@ET.COM ')).toBe(true);
    expect(isAllowedSongbookEmail('someoneelse@gmail.com')).toBe(false);
    expect(isAllowedSongbookEmail('')).toBe(false);
    expect(isAllowedSongbookEmail(null)).toBe(false);
  });

  it('merges identical songs immediately, adds missing songs to both sides, and flags differing lyrics', () => {
    const identicalLocal = parseSongTXT('[Verse 1]\nPraise the Lord\nAmen', {
      id: 'local-1',
      title: 'Praise',
      artist: '',
    }).song;

    const conflictLocal = parseSongTXT('[Verse 1]\nLocal version line 1\nLocal line 2', {
      id: 'local-2',
      title: 'Gratitude',
      artist: 'Brandon Lake',
    }).song;

    const localOnly = parseSongTXT('[Chorus]\nOnly in BSP', {
      id: 'local-3',
      title: 'Local Exclusive',
      artist: 'CityAlight',
    }).song;

    const remoteDocs = [
      {
        id: 'fb-praise',
        title: 'Praise',
        artists: 'Elevation Worship, Brandon Lake',
        lyrics: '[Verse 1]\nPraise the Lord\nAmen',
      },
      {
        id: 'fb-gratitude',
        title: 'Gratitude',
        artists: 'Brandon Lake',
        lyrics: '[Verse 1]\nSongbook different lyric\nHallelujah',
      },
      {
        id: 'fb-only',
        title: 'Way Maker',
        artists: 'Sinach',
        lyrics: '[Chorus]\nYou are here\nMoving in our midst',
      },
    ];

    const res = reconcileSongbookMerge([identicalLocal, conflictLocal, localOnly], remoteDocs, {
      mode: 'manual-merge',
    });

    // Identical song merged with remote artists & docId
    const praise = res.mergedLocalSongs.find((s) => s.title === 'Praise');
    expect(praise?.songbookDocId).toBe('fb-praise');
    expect(praise?.artist).toBe('Elevation Worship, Brandon Lake');

    // Remote-only song added locally
    const wayMaker = res.mergedLocalSongs.find((s) => s.title === 'Way Maker');
    expect(wayMaker?.songbookDocId).toBe('fb-only');
    expect(wayMaker?.artist).toBe('Sinach');

    // Local-only song queued for Firestore creation
    expect(res.toCreateInRemote).toHaveLength(1);
    expect(res.toCreateInRemote[0].payload.title).toBe('Local Exclusive');
    expect(res.toCreateInRemote[0].payload.artists).toBe('CityAlight');

    // Same-title song with different lyrics triggers user conflict prompt
    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].title).toBe('Gratitude');
  });

  it('auto-applies remote edits when local was untouched and removes remotely deleted linked songs in auto-sync mode', () => {
    const syncedSong = parseSongbookDocToSong({
      id: 'fb-1',
      title: 'Holy Forever',
      artists: 'Chris Tomlin',
      lyrics: '[Verse 1]\nA thousand generations',
    });

    const deletedRemotely = parseSongbookDocToSong({
      id: 'fb-deleted',
      title: 'Old Song',
      artists: 'Someone',
      lyrics: '[Verse 1]\nOld lyrics',
    });

    const res = reconcileSongbookMerge(
      [syncedSong, deletedRemotely],
      [
        {
          id: 'fb-1',
          title: 'Holy Forever',
          artists: 'Chris Tomlin, Bethel Music',
          lyrics: '[Verse 1]\nA thousand generations\nFalling down in worship',
        },
      ],
      { mode: 'auto-sync' }
    );

    expect(res.conflicts).toHaveLength(0);
    expect(res.removedLocalIds).toEqual([deletedRemotely.id]);
    expect(res.mergedLocalSongs).toHaveLength(1);
    expect(res.mergedLocalSongs[0].artist).toBe('Chris Tomlin, Bethel Music');
    expect(res.mergedLocalSongs[0].sections[0].lyrics).toEqual([
      'A thousand generations',
      'Falling down in worship',
    ]);
  });
});
