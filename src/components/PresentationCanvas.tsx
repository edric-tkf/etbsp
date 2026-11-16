import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DisplaySettings, PresentationState } from '../types/models';
import { normalizeFontFamilyName } from '../utils/fontEngine';

interface PresentationCanvasProps {
  presentation: PresentationState;
  settings: DisplaySettings;
  isPreview?: boolean;
  className?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return `rgba(11, 20, 42, ${alpha})`;
}

export const PresentationCanvas: React.FC<PresentationCanvasProps> = ({
  presentation,
  settings,
  isPreview = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const [scaleRatio, setScaleRatio] = useState(1);

  // Measure container accurately using layout effect + ResizeObserver from virtual 1920x1080 stage
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setScaleRatio(Math.min(rect.width / 1920, rect.height / 1080));
      } else if (rect.width > 0) {
        setScaleRatio(rect.width / 1920);
      }
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isTransparentMode =
    settings.transparentBackground || settings.backgroundType === 'transparent';
  const isLowerThird =
    presentation.isLive &&
    presentation.activeType !== 'none' &&
    presentation.bibleDisplayMode === 'lower-third';

  const bibleSlide = presentation.bible;
  const songSlide = presentation.song;

  // Background CSS computation
  const backgroundStyle = useMemo<React.CSSProperties>(() => {
    if (!presentation.isLive || presentation.activeType === 'none') {
      if (isTransparentMode && !isPreview) return { background: 'transparent' };
      return { backgroundColor: '#000000' };
    }
    if (isTransparentMode || isLowerThird) {
      return { background: 'transparent' };
    }
    if (settings.backgroundType === 'solid') {
      const color =
        presentation.activeType === 'bible'
          ? settings.solidColor || settings.defaultBibleBackgroundColor
          : settings.defaultSongBackgroundColor || settings.solidColor;
      return { backgroundColor: color };
    }
    if (settings.backgroundType === 'gradient') {
      return {
        backgroundImage: `linear-gradient(${settings.gradientAngle}deg, ${settings.gradientFrom}, ${settings.gradientTo})`,
      };
    }
    return { backgroundColor: '#090c12' };
  }, [presentation.isLive, presentation.activeType, settings, isTransparentMode, isLowerThird, isPreview]);

  const lowerThirdAtTop = settings.lowerThirdPosition === 'top';
  const showLowerThirdBox =
    !isTransparentMode &&
    settings.lowerThirdShowBackground !== false &&
    (settings.lowerThirdOpacity ?? 0.9) > 0;

  const slideAnimationKey =
    presentation.isLive && presentation.activeType !== 'none'
      ? `${presentation.activeType}-${presentation.bibleDisplayMode}-${presentation.revision}`
      : 'standby';

  const animationStyle = useMemo<React.CSSProperties>(() => {
    const duration = Math.max(60, settings.transitionDurationMs || 320);
    if (settings.transition === 'cut') {
      return { animation: 'none' };
    }
    if (settings.transition === 'slide') {
      const animName = isLowerThird && lowerThirdAtTop ? 'etbsp-slide-in-top' : 'etbsp-slide-in';
      return {
        animation: `${animName} ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
      };
    }
    if (settings.transition === 'zoom') {
      return {
        animation: `etbsp-zoom-in ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
      };
    }
    return {
      animation: `etbsp-fade-in ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
    };
  }, [settings.transition, settings.transitionDurationMs, isLowerThird, lowerThirdAtTop]);

  const alignClass =
    settings.textAlign === 'left'
      ? 'items-start text-left'
      : settings.textAlign === 'right'
      ? 'items-end text-right'
      : 'items-center text-center';

  const textShadowStyle = settings.textShadow
    ? '0 4px 24px rgba(0, 0, 0, 0.8), 0 1px 4px rgba(0, 0, 0, 0.95)'
    : 'none';

  const resolvedFont = normalizeFontFamilyName(settings.fontFamily);
  const wordSpacingValue = `${settings.wordSpacingPx ?? 0}px`;
  const lineHeightValue = settings.lineHeight ?? 1.25;
  const songGapValue = settings.songLineGapPx ?? 16;

  // Fixed pixel font sizes (never scaled by word/character count) applied equally to Bible and Songs
  const fullScreenPx = Math.max(
    10,
    Math.round(
      typeof settings.fullscreenFontSizePx === 'number' && settings.fullscreenFontSizePx > 0
        ? settings.fullscreenFontSizePx
        : 64 * (settings.fontSizeScale || 1)
    )
  );
  const lowerThirdPx = Math.max(
    10,
    Math.round(
      typeof settings.lowerThirdFontSizePx === 'number' && settings.lowerThirdFontSizePx > 0
        ? settings.lowerThirdFontSizePx
        : 42 * (settings.fontSizeScale || 1)
    )
  );
  const activeFontPx = isLowerThird ? lowerThirdPx : fullScreenPx;
  const bibleRefFontPx = Math.max(12, Math.round(activeFontPx * 0.52));

  const bibleTextUpper = bibleSlide ? bibleSlide.text.toUpperCase() : '';
  const bibleRefUpper = bibleSlide
    ? `${bibleSlide.book} ${bibleSlide.chapter}:${bibleSlide.verse} · ${bibleSlide.translationAbbr}`.toUpperCase()
    : '';
  const songLinesUpper = songSlide ? songSlide.lines.slice(0, 2).map((l) => l.toUpperCase()) : [];

  const safeMarginPct = Math.max(0, settings.safeMarginPercent ?? 0);
  const lowerThirdHeightPx = Math.max(
    0,
    Math.round(((settings.lowerThirdHeightPercent ?? 28) / 100) * 1080)
  );
  const lowerThirdPadY = showLowerThirdBox
    ? Math.min(28, Math.max(2, Math.round(lowerThirdHeightPx * 0.1)))
    : Math.min(16, Math.max(0, Math.round(lowerThirdHeightPx * 0.06)));
  const lowerThirdPadX = showLowerThirdBox ? 40 : 16;

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video overflow-hidden select-none ${
        isPreview && (isTransparentMode || isLowerThird)
          ? 'bg-[radial-gradient(#2c323d_1px,transparent_1px)] [background-size:14px_14px] bg-[#0c0f15]'
          : ''
      } ${className}`}
      style={{
        fontFamily: `"${resolvedFont}", "Plus Jakarta Sans", sans-serif`,
      }}
    >
      {/* Virtual 1920x1080 scaled stage */}
      <div
        className="absolute top-0 left-0 w-[1920px] h-[1080px] origin-top-left overflow-hidden"
        style={{
          transform: `scale(${scaleRatio})`,
          ...backgroundStyle,
        }}
      >
        {/* Background Media Layer (Image or Video) when not transparent / lower-third */}
        {presentation.isLive &&
          presentation.activeType !== 'none' &&
          !isTransparentMode &&
          !isLowerThird && (
            <>
              {settings.backgroundType === 'image' && settings.backgroundImageUrl && (
                <img
                  src={settings.backgroundImageUrl}
                  alt="Presentation Background"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ opacity: settings.backgroundOpacity }}
                />
              )}
              {settings.backgroundType === 'video' && settings.backgroundVideoUrl && (
                <video
                  ref={bgVideoRef}
                  src={settings.backgroundVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ opacity: settings.backgroundOpacity }}
                />
              )}
              {(settings.backgroundType === 'image' || settings.backgroundType === 'video') && (
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
              )}
            </>
          )}

        {/* STANDBY / CLEARED OUTPUT */}
        {(!presentation.isLive || presentation.activeType === 'none') && (
          <div className="absolute inset-0 flex items-center justify-center">
            {isPreview && (
              <div className="text-center text-slate-500 px-20">
                <div className="text-[36px] font-semibold tracking-tight text-slate-400">
                  OUTPUT CLEARED (STANDBY)
                </div>
                <div className="text-[22px] mt-3 text-slate-500">
                  CLICK ANY BIBLE VERSE OR SONG SLIDE ROW TO PROJECT LIVE
                </div>
              </div>
            )}
          </div>
        )}

        {/* FULL-SCREEN MODE (Bible or Song) */}
        {presentation.isLive &&
          presentation.activeType !== 'none' &&
          !isLowerThird && (
            <div
              key={slideAnimationKey}
              className="absolute inset-0 flex flex-col justify-center overflow-hidden"
              style={{
                padding: `${safeMarginPct}%`,
                ...animationStyle,
              }}
            >
              <div className={`w-full max-h-full overflow-hidden flex flex-col justify-center ${alignClass}`}>
                {presentation.activeType === 'bible' && bibleSlide && (
                  <>
                    {settings.showBibleReferenceLabel && (
                      <div
                        className={`inline-flex items-center gap-4 px-8 py-3 font-bold tracking-wide shadow-lg shrink-0 ${
                          settings.bibleReferenceRounded ? 'rounded-full' : 'rounded-xl'
                        }`}
                        style={{
                          backgroundColor: settings.bibleReferenceBgColor,
                          color: settings.bibleReferenceTextColor,
                          fontSize: `${bibleRefFontPx}px`,
                          marginBottom: `${Math.max(12, Math.round(activeFontPx * 0.45))}px`,
                          wordSpacing: wordSpacingValue,
                          textTransform: 'uppercase',
                        }}
                      >
                        <span>{bibleRefUpper}</span>
                      </div>
                    )}

                    <p
                      className="font-bold w-full uppercase break-words"
                      style={{
                        color: settings.textColor,
                        fontSize: `${activeFontPx}px`,
                        lineHeight: lineHeightValue,
                        wordSpacing: wordSpacingValue,
                        textShadow: textShadowStyle,
                        textTransform: 'uppercase',
                      }}
                    >
                      {bibleTextUpper}
                    </p>
                  </>
                )}

                {presentation.activeType === 'song' && songSlide && (
                  <div
                    className={`flex flex-col w-full ${alignClass}`}
                    style={{ gap: `${songGapValue}px` }}
                  >
                    {songLinesUpper.map((line, i) => (
                      <p
                        key={i}
                        className="font-bold w-full uppercase break-words"
                        style={{
                          color: settings.textColor,
                          fontSize: `${activeFontPx}px`,
                          lineHeight: lineHeightValue,
                          wordSpacing: wordSpacingValue,
                          textShadow: textShadowStyle,
                          textTransform: 'uppercase',
                        }}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* LOWER-THIRD MODE (Works for BOTH Bible & Songs, Top or Bottom) */}
        {presentation.isLive &&
          presentation.activeType !== 'none' &&
          isLowerThird && (
            <div
              key={slideAnimationKey}
              className={`absolute left-0 right-0 flex justify-center ${
                lowerThirdAtTop ? 'top-0 items-start' : 'bottom-0 items-end'
              }`}
              style={{
                paddingLeft: `${safeMarginPct}%`,
                paddingRight: `${safeMarginPct}%`,
                paddingTop: lowerThirdAtTop ? `${safeMarginPct}%` : undefined,
                paddingBottom: !lowerThirdAtTop ? `${safeMarginPct}%` : undefined,
                ...animationStyle,
              }}
            >
              <div
                className={`w-full flex flex-col justify-center overflow-hidden ${alignClass} ${
                  showLowerThirdBox
                    ? `rounded-3xl border border-white/15 shadow-2xl ${
                        settings.lowerThirdBlur ? 'backdrop-blur-md' : ''
                      }`
                    : ''
                }`}
                style={{
                  minHeight: `${lowerThirdHeightPx}px`,
                  paddingTop: `${lowerThirdPadY}px`,
                  paddingBottom: `${lowerThirdPadY}px`,
                  paddingLeft: `${lowerThirdPadX}px`,
                  paddingRight: `${lowerThirdPadX}px`,
                  backgroundColor: showLowerThirdBox
                    ? hexToRgba(settings.lowerThirdBgColor || '#0b142a', settings.lowerThirdOpacity)
                    : 'transparent',
                }}
              >
                {presentation.activeType === 'bible' && bibleSlide && (
                  <>
                    {settings.showBibleReferenceLabel && (
                      <div
                        className="flex items-center shrink-0"
                        style={{
                          marginBottom: `${Math.max(4, Math.round(activeFontPx * 0.22))}px`,
                        }}
                      >
                        <span
                          className={`inline-flex items-center gap-3 px-5 py-1 font-bold uppercase tracking-wide ${
                            settings.bibleReferenceRounded ? 'rounded-full' : 'rounded-lg'
                          }`}
                          style={{
                            backgroundColor: settings.bibleReferenceBgColor,
                            color: settings.bibleReferenceTextColor,
                            fontSize: `${bibleRefFontPx}px`,
                            wordSpacing: wordSpacingValue,
                            textTransform: 'uppercase',
                          }}
                        >
                          {bibleRefUpper}
                        </span>
                      </div>
                    )}

                    <p
                      className="font-bold uppercase w-full break-words"
                      style={{
                        color: settings.textColor,
                        fontSize: `${activeFontPx}px`,
                        lineHeight: lineHeightValue,
                        wordSpacing: wordSpacingValue,
                        textShadow: textShadowStyle,
                        textTransform: 'uppercase',
                      }}
                    >
                      {bibleTextUpper}
                    </p>
                  </>
                )}

                {presentation.activeType === 'song' && songSlide && (
                  <div
                    className={`flex flex-col w-full ${alignClass}`}
                    style={{ gap: `${songGapValue}px` }}
                  >
                    {songLinesUpper.map((line, i) => (
                      <p
                        key={i}
                        className="font-bold w-full uppercase break-words"
                        style={{
                          color: settings.textColor,
                          fontSize: `${activeFontPx}px`,
                          lineHeight: lineHeightValue,
                          wordSpacing: wordSpacingValue,
                          textShadow: textShadowStyle,
                          textTransform: 'uppercase',
                        }}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};
