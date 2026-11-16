import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  Upload,
} from 'lucide-react';
import type {
  BibleDisplayMode,
  BibleTranslation,
  LowerThirdPosition,
  PresentationState,
} from '../types/models';
import {
  getBookAutocompleteSuggestions,
  parseBibleReference,
  resolveCanonicalBookName,
} from '../utils/bibleEngine';

interface BibleWorkspaceProps {
  translations: BibleTranslation[];
  selectedTranslationId: string;
  onSelectTranslation: (id: string) => void;
  selectedBook: string;
  selectedChapter: number;
  selectedVerse: number;
  onSelectReference: (book: string, chapter: number, verse: number) => void;
  onProjectVerse: (book: string, chapter: number, verse: number) => void;
  bibleDisplayMode: BibleDisplayMode;
  onChangeBibleDisplayMode: (mode: BibleDisplayMode) => void;
  lowerThirdPosition: LowerThirdPosition;
  onChangeLowerThirdPosition: (pos: LowerThirdPosition) => void;
  presentation: PresentationState;
  onOpenImportBible: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const BibleWorkspace: React.FC<BibleWorkspaceProps> = ({
  translations,
  selectedTranslationId,
  onSelectTranslation,
  selectedBook,
  selectedChapter,
  selectedVerse,
  onSelectReference,
  onProjectVerse,
  bibleDisplayMode,
  onChangeBibleDisplayMode,
  lowerThirdPosition,
  onChangeLowerThirdPosition,
  presentation,
  onOpenImportBible,
  searchInputRef,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const localSearchRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef || localSearchRef;

  const activeTranslation = useMemo(
    () => translations.find((t) => t.id === selectedTranslationId) || translations[0],
    [translations, selectedTranslationId]
  );

  const availableBooks = activeTranslation?.books || [];
  const activeBookObj =
    availableBooks.find(
      (b) =>
        b.name.toLowerCase() ===
        (resolveCanonicalBookName(selectedBook) || selectedBook).toLowerCase()
    ) || availableBooks[0];

  const availableChapters = activeBookObj?.chapters || [];
  const activeChapterObj =
    availableChapters.find((c) => c.number === selectedChapter) || availableChapters[0];
  const verses = activeChapterObj?.verses || [];

  const suggestions = useMemo(
    () => getBookAutocompleteSuggestions(searchQuery, 7),
    [searchQuery]
  );

  const handleSearchSubmit = (raw: string) => {
    if (!activeTranslation) return;
    const parsed = parseBibleReference(raw);
    if (!parsed) {
      setSearchError('Enter a reference such as "Gen 1:1" or "John 3:16".');
      return;
    }
    const bookObj = activeTranslation.books.find(
      (b) => b.name.toLowerCase() === parsed.book.toLowerCase()
    );
    if (!bookObj) {
      setSearchError(`${parsed.book} was not found in ${activeTranslation.abbreviation}.`);
      return;
    }
    const chapObj = bookObj.chapters.find((c) => c.number === parsed.chapter) || bookObj.chapters[0];
    const verseObj = chapObj?.verses.find((v) => v.number === parsed.verse) || chapObj?.verses[0];
    if (!chapObj || !verseObj) {
      setSearchError(`${parsed.book} ${parsed.chapter}:${parsed.verse} is not in this translation.`);
      return;
    }

    setSearchError(null);
    setShowSuggestions(false);
    onSelectReference(bookObj.name, chapObj.number, verseObj.number);
    onProjectVerse(bookObj.name, chapObj.number, verseObj.number);
  };

  const currentChapterIdx = availableChapters.findIndex((c) => c.number === activeChapterObj?.number);
  const canPrevChapter = currentChapterIdx > 0;
  const canNextChapter = currentChapterIdx >= 0 && currentChapterIdx < availableChapters.length - 1;

  if (translations.length === 0) {
    return (
      <div className="h-full rounded-lg bg-[#171b22] border border-[#2c323d] flex flex-col items-center justify-center p-6 text-center">
        <BookOpen className="w-8 h-8 text-slate-500 mb-2.5" />
        <h3 className="text-xs font-semibold text-white">No Bible Translations Imported</h3>
        <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
          Import a Bible translation (XML, JSON, or CSV) or restore a backup in Settings to begin projecting Scripture.
        </p>
        <button
          type="button"
          onClick={onOpenImportBible}
          className="mt-3.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white flex items-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import Bible</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Top Controls Bar */}
      <div className="rounded-lg bg-[#171b22] border border-[#2c323d] p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Bible translations">
            {translations.map((t) => {
              const active = t.id === activeTranslation?.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTranslation(t.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#20242c] text-slate-300 hover:text-white hover:bg-[#252a33] border border-[#2c323d]'
                  }`}
                >
                  {t.abbreviation}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Full-Screen / Lower-Third Mode */}
            <div className="flex items-center p-0.5 rounded bg-[#11141a] border border-[#2c323d]">
              <button
                type="button"
                onClick={() => onChangeBibleDisplayMode('fullscreen')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                  bibleDisplayMode === 'fullscreen'
                    ? 'bg-[#252a33] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Full-Screen
              </button>
              <button
                type="button"
                onClick={() => onChangeBibleDisplayMode('lower-third')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                  bibleDisplayMode === 'lower-third'
                    ? 'bg-[#252a33] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Lower-Third
              </button>
            </div>

            {bibleDisplayMode === 'lower-third' && (
              <div className="flex items-center p-0.5 rounded bg-[#11141a] border border-[#2c323d]">
                <button
                  type="button"
                  onClick={() => onChangeLowerThirdPosition('top')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                    lowerThirdPosition === 'top'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Top
                </button>
                <button
                  type="button"
                  onClick={() => onChangeLowerThirdPosition('bottom')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                    lowerThirdPosition === 'bottom'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Bottom
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onOpenImportBible}
              className="px-2.5 py-1 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-[11px] font-medium text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            >
              <Upload className="w-3 h-3 text-blue-400" />
              <span>Import Bible</span>
            </button>
          </div>
        </div>

        {/* Search + Book + Chapter Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
          <div className="md:col-span-5 relative">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchSubmit(searchQuery);
              }}
              className="relative"
            >
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                aria-label="Search Bible reference"
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchError(null);
                  setShowSuggestions(true);
                }}
                placeholder='Search (e.g. "Gen 1:1", "John 3:16")'
                className="w-full rounded bg-[#11141a] border border-[#2c323d] pl-7 pr-12 py-1.5 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-[10px] font-semibold text-white"
              >
                Go
              </button>
            </form>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded bg-[#20242c] border border-[#2c323d] shadow-xl overflow-hidden">
                {suggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearchQuery(sug);
                      handleSearchSubmit(sug);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-[#252a33] flex items-center justify-between"
                  >
                    <span>{sug}</span>
                    <span className="text-[10px] text-slate-500">{activeTranslation?.abbreviation}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Select Bible book"
              value={activeBookObj?.name || ''}
              onChange={(e) => {
                const nextBook = availableBooks.find((b) => b.name === e.target.value);
                if (nextBook) {
                  const firstCh = nextBook.chapters[0]?.number || 1;
                  const firstV = nextBook.chapters[0]?.verses[0]?.number || 1;
                  onSelectReference(nextBook.name, firstCh, firstV);
                }
              }}
              className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
            >
              {availableBooks.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex items-center gap-1">
            <button
              type="button"
              disabled={!canPrevChapter}
              onClick={() => {
                if (!canPrevChapter || !activeBookObj) return;
                const prevCh = availableChapters[currentChapterIdx - 1];
                onSelectReference(activeBookObj.name, prevCh.number, prevCh.verses[0]?.number || 1);
              }}
              className="p-1.5 rounded bg-[#20242c] border border-[#2c323d] text-slate-300 hover:text-white disabled:opacity-35"
              aria-label="Previous chapter"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <select
              aria-label="Select Bible chapter"
              value={activeChapterObj?.number || 1}
              onChange={(e) => {
                if (!activeBookObj) return;
                const chNum = Number(e.target.value);
                const chObj = availableChapters.find((c) => c.number === chNum);
                onSelectReference(activeBookObj.name, chNum, chObj?.verses[0]?.number || 1);
              }}
              className="flex-1 rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white font-mono-tabular focus:outline-none focus:border-blue-500"
            >
              {availableChapters.map((c) => (
                <option key={c.number} value={c.number}>
                  Ch {c.number}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!canNextChapter}
              onClick={() => {
                if (!canNextChapter || !activeBookObj) return;
                const nextCh = availableChapters[currentChapterIdx + 1];
                onSelectReference(activeBookObj.name, nextCh.number, nextCh.verses[0]?.number || 1);
              }}
              className="p-1.5 rounded bg-[#20242c] border border-[#2c323d] text-slate-300 hover:text-white disabled:opacity-35"
              aria-label="Next chapter"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {searchError && (
          <div className="rounded bg-amber-950/40 border border-amber-800/60 px-2.5 py-1.5 text-[11px] text-amber-200 flex items-center justify-between gap-2">
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* Compact Verse List (Click cell directly to project live) */}
      <div className="flex-1 overflow-y-auto rounded-lg bg-[#171b22] border border-[#2c323d] divide-y divide-[#252a33]">
        {verses.length === 0 ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center p-6 text-center">
            <BookOpen className="w-7 h-7 text-slate-500 mb-2" />
            <div className="text-xs font-semibold text-slate-200">No verses available</div>
            <p className="text-[11px] text-slate-400 mt-1">
              Select another book/chapter or import a Bible file.
            </p>
          </div>
        ) : (
          verses.map((v) => {
            const bookName = activeBookObj?.name || selectedBook;
            const chapNum = activeChapterObj?.number || selectedChapter;
            const isSelected =
              bookName.toLowerCase() === selectedBook.toLowerCase() &&
              chapNum === selectedChapter &&
              v.number === selectedVerse;
            const isLiveVerse =
              presentation.isLive &&
              presentation.activeType === 'bible' &&
              presentation.bible?.translationId === activeTranslation?.id &&
              presentation.bible?.book.toLowerCase() === bookName.toLowerCase() &&
              presentation.bible?.chapter === chapNum &&
              presentation.bible?.verse === v.number;

            return (
              <button
                key={v.number}
                type="button"
                onClick={() => onProjectVerse(bookName, chapNum, v.number)}
                className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors cursor-pointer ${
                  isLiveVerse
                    ? 'bg-emerald-950/45 text-white'
                    : isSelected
                    ? 'bg-[#20242c] text-white'
                    : 'hover:bg-[#20242c]/80 text-slate-200'
                }`}
              >
                <span
                  className={`min-w-[26px] px-1.5 py-0.5 rounded text-center text-[10px] font-bold font-mono-tabular shrink-0 mt-0.5 ${
                    isLiveVerse
                      ? 'bg-emerald-600 text-white'
                      : isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#252a33] text-slate-300'
                  }`}
                >
                  {v.number}
                </span>

                <span className="flex-1 min-w-0 text-xs leading-snug text-slate-100">
                  {v.text}
                </span>

                {isLiveVerse && (
                  <span className="text-[10px] font-bold text-emerald-400 tracking-wide shrink-0 mt-0.5">
                    LIVE
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
