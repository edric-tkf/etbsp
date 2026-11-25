import React, { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CornerDownLeft, Delete, Keyboard, X } from 'lucide-react';

export type OnScreenKeyAction =
  | { type: 'char'; value: string }
  | { type: 'backspace' }
  | { type: 'enter' }
  | { type: 'tab' }
  | { type: 'space' }
  | { type: 'arrow'; direction: 'left' | 'right' | 'up' | 'down' };

interface OnScreenKeyboardProps {
  activeTargetLabel: string;
  onKeyAction: (action: OnScreenKeyAction) => void;
  onClose: () => void;
}

interface KeyDef {
  id: string;
  normal: string;
  shift?: string;
  widthClass?: string;
  special?: 'backspace' | 'tab' | 'caps' | 'enter' | 'shift-left' | 'shift-right' | 'space' | 'arrow-left' | 'arrow-up' | 'arrow-down' | 'arrow-right';
  label?: string;
}

const KEY_ROWS: KeyDef[][] = [
  [
    { id: 'backtick', normal: '`', shift: '~' },
    { id: '1', normal: '1', shift: '!' },
    { id: '2', normal: '2', shift: '@' },
    { id: '3', normal: '3', shift: '#' },
    { id: '4', normal: '4', shift: '$' },
    { id: '5', normal: '5', shift: '%' },
    { id: '6', normal: '6', shift: '^' },
    { id: '7', normal: '7', shift: '&' },
    { id: '8', normal: '8', shift: '*' },
    { id: '9', normal: '9', shift: '(' },
    { id: '0', normal: '0', shift: ')' },
    { id: 'minus', normal: '-', shift: '_' },
    { id: 'equal', normal: '=', shift: '+' },
    { id: 'backspace', normal: 'Backspace', special: 'backspace', widthClass: 'flex-[1.85]', label: 'Backspace' },
  ],
  [
    { id: 'tab', normal: 'Tab', special: 'tab', widthClass: 'flex-[1.45]', label: 'Tab' },
    { id: 'q', normal: 'q', shift: 'Q' },
    { id: 'w', normal: 'w', shift: 'W' },
    { id: 'e', normal: 'e', shift: 'E' },
    { id: 'r', normal: 'r', shift: 'R' },
    { id: 't', normal: 't', shift: 'T' },
    { id: 'y', normal: 'y', shift: 'Y' },
    { id: 'u', normal: 'u', shift: 'U' },
    { id: 'i', normal: 'i', shift: 'I' },
    { id: 'o', normal: 'o', shift: 'O' },
    { id: 'p', normal: 'p', shift: 'P' },
    { id: 'lbracket', normal: '[', shift: '{' },
    { id: 'rbracket', normal: ']', shift: '}' },
    { id: 'backslash', normal: '\\', shift: '|', widthClass: 'flex-[1.35]' },
  ],
  [
    { id: 'caps', normal: 'Caps Lock', special: 'caps', widthClass: 'flex-[1.75]', label: 'Caps' },
    { id: 'a', normal: 'a', shift: 'A' },
    { id: 's', normal: 's', shift: 'S' },
    { id: 'd', normal: 'd', shift: 'D' },
    { id: 'f', normal: 'f', shift: 'F' },
    { id: 'g', normal: 'g', shift: 'G' },
    { id: 'h', normal: 'h', shift: 'H' },
    { id: 'j', normal: 'j', shift: 'J' },
    { id: 'k', normal: 'k', shift: 'K' },
    { id: 'l', normal: 'l', shift: 'L' },
    { id: 'semicolon', normal: ';', shift: ':' },
    { id: 'quote', normal: "'", shift: '"' },
    { id: 'enter', normal: 'Enter', special: 'enter', widthClass: 'flex-[2.1]', label: 'Enter' },
  ],
  [
    { id: 'shift-left', normal: 'Shift', special: 'shift-left', widthClass: 'flex-[2.25]', label: 'Shift' },
    { id: 'z', normal: 'z', shift: 'Z' },
    { id: 'x', normal: 'x', shift: 'X' },
    { id: 'c', normal: 'c', shift: 'C' },
    { id: 'v', normal: 'v', shift: 'V' },
    { id: 'b', normal: 'b', shift: 'B' },
    { id: 'n', normal: 'n', shift: 'N' },
    { id: 'm', normal: 'm', shift: 'M' },
    { id: 'comma', normal: ',', shift: '<' },
    { id: 'period', normal: '.', shift: '>' },
    { id: 'slash', normal: '/', shift: '?' },
    { id: 'shift-right', normal: 'Shift', special: 'shift-right', widthClass: 'flex-[2.25]', label: 'Shift' },
  ],
  [
    { id: 'bracket-open-quick', normal: '[', shift: '[', widthClass: 'flex-[0.95]' },
    { id: 'bracket-close-quick', normal: ']', shift: ']', widthClass: 'flex-[0.95]' },
    { id: 'space', normal: 'Space', special: 'space', widthClass: 'flex-[6.5]', label: 'Space' },
    { id: 'arrow-left', normal: 'Left', special: 'arrow-left', widthClass: 'flex-[0.95]' },
    { id: 'arrow-up', normal: 'Up', special: 'arrow-up', widthClass: 'flex-[0.95]' },
    { id: 'arrow-down', normal: 'Down', special: 'arrow-down', widthClass: 'flex-[0.95]' },
    { id: 'arrow-right', normal: 'Right', special: 'arrow-right', widthClass: 'flex-[0.95]' },
  ],
];

const isLetterKey = (key: KeyDef): boolean => /^[a-z]$/.test(key.normal);

export const OnScreenKeyboard: React.FC<OnScreenKeyboardProps> = ({
  activeTargetLabel,
  onKeyAction,
  onClose,
}) => {
  const [shiftActive, setShiftActive] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const handleKeyPress = (key: KeyDef) => {
    switch (key.special) {
      case 'caps':
        setCapsLockActive((prev) => !prev);
        return;
      case 'shift-left':
      case 'shift-right':
        setShiftActive((prev) => !prev);
        return;
      case 'backspace':
        onKeyAction({ type: 'backspace' });
        return;
      case 'enter':
        onKeyAction({ type: 'enter' });
        return;
      case 'tab':
        onKeyAction({ type: 'tab' });
        return;
      case 'space':
        onKeyAction({ type: 'space' });
        return;
      case 'arrow-left':
        onKeyAction({ type: 'arrow', direction: 'left' });
        return;
      case 'arrow-right':
        onKeyAction({ type: 'arrow', direction: 'right' });
        return;
      case 'arrow-up':
        onKeyAction({ type: 'arrow', direction: 'up' });
        return;
      case 'arrow-down':
        onKeyAction({ type: 'arrow', direction: 'down' });
        return;
      default: {
        const useUpperLetter = isLetterKey(key) && (shiftActive !== capsLockActive);
        const char = isLetterKey(key)
          ? useUpperLetter
            ? key.normal.toUpperCase()
            : key.normal.toLowerCase()
          : shiftActive && key.shift
          ? key.shift
          : key.normal;

        onKeyAction({ type: 'char', value: char });
        if (shiftActive) {
          setShiftActive(false);
        }
      }
    }
  };

  return (
    <div
      className="rounded-lg bg-[#141820] border border-[#2c323d] shadow-2xl p-2.5 select-none shrink-0"
      role="region"
      aria-label="On-screen keyboard"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#252a33]">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Keyboard className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-white">On-Screen Keyboard</span>
          <span className="text-[11px] text-slate-400">
            · Typing into <span className="text-blue-300 font-medium">{activeTargetLabel}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 rounded bg-[#20242c] hover:bg-[#2a303b] border border-[#2c323d] text-[11px] text-slate-300 hover:text-white flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          <span>Close</span>
        </button>
      </div>

      <div className="space-y-1.5">
        {KEY_ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="flex items-stretch gap-1.5">
            {row.map((key) => {
              const isLetter = isLetterKey(key);
              const showUpper = isLetter ? shiftActive !== capsLockActive : shiftActive;
              const isModifierActive =
                (key.special === 'caps' && capsLockActive) ||
                ((key.special === 'shift-left' || key.special === 'shift-right') && shiftActive);

              const widthCls = key.widthClass || 'flex-1';

              return (
                <button
                  key={key.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleKeyPress(key)}
                  aria-label={key.label || key.normal}
                  className={`${widthCls} min-w-0 h-10 px-1.5 rounded-md border border-b-2 transition-all active:translate-y-px flex flex-col items-center justify-center leading-none cursor-pointer ${
                    key.special === 'enter'
                      ? 'bg-blue-600 hover:bg-blue-500 border-blue-800 text-white font-semibold'
                      : isModifierActive
                      ? 'bg-blue-600/25 border-blue-500 text-blue-200 font-semibold'
                      : key.special
                      ? 'bg-[#1e232d] hover:bg-[#282f3c] border-[#0c0f14] text-slate-200 font-medium'
                      : 'bg-[#252b36] hover:bg-[#303846] border-[#0c0f14] text-white font-medium'
                  }`}
                >
                  {key.special === 'backspace' ? (
                    <span className="flex items-center gap-1 text-[11px]">
                      <Delete className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Backspace</span>
                    </span>
                  ) : key.special === 'enter' ? (
                    <span className="flex items-center gap-1 text-[11px]">
                      <CornerDownLeft className="w-3.5 h-3.5" />
                      <span>Enter</span>
                    </span>
                  ) : key.special === 'caps' ? (
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          capsLockActive ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-600'
                        }`}
                      />
                      <span>Caps</span>
                    </span>
                  ) : key.special === 'shift-left' || key.special === 'shift-right' ? (
                    <span className="text-[11px]">Shift</span>
                  ) : key.special === 'tab' ? (
                    <span className="text-[11px]">Tab ⇥</span>
                  ) : key.special === 'space' ? (
                    <span className="text-[11px] text-slate-400 tracking-wide">Space</span>
                  ) : key.special === 'arrow-left' ? (
                    <ArrowLeft className="w-3.5 h-3.5" />
                  ) : key.special === 'arrow-right' ? (
                    <ArrowRight className="w-3.5 h-3.5" />
                  ) : key.special === 'arrow-up' ? (
                    <ArrowUp className="w-3.5 h-3.5" />
                  ) : key.special === 'arrow-down' ? (
                    <ArrowDown className="w-3.5 h-3.5" />
                  ) : isLetter ? (
                    <span className="text-sm font-semibold">
                      {showUpper ? key.normal.toUpperCase() : key.normal.toLowerCase()}
                    </span>
                  ) : (
                    <div className="flex flex-col items-center justify-center leading-tight">
                      {key.shift && key.shift !== key.normal && (
                        <span
                          className={`text-[9px] ${
                            shiftActive ? 'text-blue-300 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {key.shift}
                        </span>
                      )}
                      <span
                        className={`text-xs ${
                          shiftActive && key.shift ? 'text-slate-400 text-[10px]' : 'text-white font-semibold'
                        }`}
                      >
                        {key.normal}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
