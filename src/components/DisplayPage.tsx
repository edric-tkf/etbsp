import React, { useEffect, useRef, useState } from 'react';
import type { CustomFont, DisplaySettings, PresentationState } from '../types/models';
import {
  DEFAULT_DISPLAY_SETTINGS,
  INITIAL_PRESENTATION_STATE,
  normalizeDisplaySettings,
} from '../data/seedData';
import { LS_KEYS } from '../utils/storage';
import { loadCustomFontsIntoDocument } from '../utils/fontEngine';
import { PresentationSyncClient } from '../utils/syncEngine';
import { PresentationCanvas } from './PresentationCanvas';

export const DisplayPage: React.FC = () => {
  const [presentation, setPresentation] = useState<PresentationState>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.PRESENTATION);
      return raw ? (JSON.parse(raw) as PresentationState) : INITIAL_PRESENTATION_STATE;
    } catch {
      return INITIAL_PRESENTATION_STATE;
    }
  });

  const [settings, setSettings] = useState<DisplaySettings>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.DISPLAY_SETTINGS);
      return raw
        ? normalizeDisplaySettings(JSON.parse(raw) as DisplaySettings)
        : DEFAULT_DISPLAY_SETTINGS;
    } catch {
      return DEFAULT_DISPLAY_SETTINGS;
    }
  });

  const [customFonts, setCustomFonts] = useState<CustomFont[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.CUSTOM_FONTS);
      return raw ? (JSON.parse(raw) as CustomFont[]) : [];
    } catch {
      return [];
    }
  });

  const bootIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadCustomFontsIntoDocument(customFonts);
  }, [customFonts]);

  useEffect(() => {
    let mounted = true;

    // Always pull authoritative saved display state from the active server on mount (avoids stale OBS localStorage)
    fetch('/api/workspace/display', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!mounted || !payload) return;
        if (payload.bootId) {
          bootIdRef.current = String(payload.bootId);
        }
        if (payload.presentationState) {
          setPresentation(payload.presentationState);
        }
        if (payload.displaySettings) {
          const normalized = normalizeDisplaySettings(payload.displaySettings);
          setSettings(normalized);
          try {
            localStorage.setItem(LS_KEYS.DISPLAY_SETTINGS, JSON.stringify(normalized));
          } catch {
            // Ignore
          }
        }
        if (Array.isArray(payload.customFonts)) {
          setCustomFonts(payload.customFonts);
          try {
            localStorage.setItem(LS_KEYS.CUSTOM_FONTS, JSON.stringify(payload.customFonts));
          } catch {
            // Ignore
          }
        }
      })
      .catch(() => {});

    const sync = new PresentationSyncClient('display', {
      onServerHello: ({ bootId }) => {
        if (!bootId) return;
        if (bootIdRef.current && bootIdRef.current !== bootId) {
          // Server restarted / app updated to a new build — reload OBS page automatically to pick up latest bundle & styles
          window.location.reload();
          return;
        }
        bootIdRef.current = bootId;
      },
      onPresentationUpdate: (nextState) => {
        if (!mounted) return;
        setPresentation(nextState);
        try {
          localStorage.setItem(LS_KEYS.PRESENTATION, JSON.stringify(nextState));
        } catch {
          // Ignore
        }
      },
      onSettingsUpdate: (nextSettings) => {
        if (!mounted) return;
        const normalized = normalizeDisplaySettings(nextSettings);
        setSettings(normalized);
        try {
          localStorage.setItem(LS_KEYS.DISPLAY_SETTINGS, JSON.stringify(normalized));
        } catch {
          // Ignore
        }
      },
      onFontsUpdate: (nextFonts) => {
        if (!mounted) return;
        setCustomFonts(nextFonts);
        try {
          localStorage.setItem(LS_KEYS.CUSTOM_FONTS, JSON.stringify(nextFonts));
        } catch {
          // Ignore
        }
      },
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      mounted = false;
      window.removeEventListener('keydown', onKeyDown);
      sync.dispose();
    };
  }, []);

  const isTransparent =
    settings.transparentBackground ||
    settings.backgroundType === 'transparent' ||
    (presentation.isLive &&
      presentation.activeType !== 'none' &&
      presentation.bibleDisplayMode === 'lower-third');

  return (
    <div
      className={`w-screen h-screen overflow-hidden flex items-center justify-center ${
        isTransparent ? 'bg-transparent' : 'bg-black'
      }`}
      onDoubleClick={() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }}
    >
      <div className="w-[min(100vw,177.78vh)] h-[min(100vh,56.25vw)] aspect-video">
        <PresentationCanvas presentation={presentation} settings={settings} />
      </div>
    </div>
  );
};
