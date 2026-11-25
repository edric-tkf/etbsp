import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { EtOAuthUser } from '../types/models';
import { ALLOWED_SONGBOOK_EMAILS } from '../firebase/firebaseClients';

interface EtOAuthModalProps {
  isOpen: boolean;
  user: EtOAuthUser | null;
  isAuthorized: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

export const EtOAuthModal: React.FC<EtOAuthModalProps> = ({
  isOpen,
  user,
  isAuthorized,
  isAuthenticating,
  authError,
  onSignIn,
  onSignOut,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-xl bg-[#171b22] border border-[#2c323d] shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[#252a33] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">ET OAuth · Songbook Sync</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close ET OAuth dialog"
                className="p-1 rounded hover:bg-[#252a33] text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {isAuthenticating ? (
                <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  <p className="text-xs font-medium text-slate-200">
                    Verifying ET OAuth session...
                  </p>
                </div>
              ) : user && isAuthorized ? (
                <div className="rounded-lg bg-[#20242c] border border-emerald-700/50 p-3.5 space-y-3">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-[#2c323d]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-sm font-bold text-blue-300">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {user.displayName}
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      </div>
                      <div className="text-xs text-slate-400 truncate">{user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="px-3 py-1.5 rounded-lg bg-[#171b22] hover:bg-red-950/50 border border-[#2c323d] text-xs font-medium text-slate-300 hover:text-red-300 flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Sign in with your authorized <strong>ET OAuth</strong> account to merge and
                    cross-sync songs with Songbook (<span className="font-mono-tabular">pnw-lyrics</span>).
                  </p>

                  <div className="rounded-lg bg-[#11141a] border border-[#252a33] px-3 py-2.5 text-xs text-slate-400">
                    <div className="font-medium text-slate-300 mb-1">Authorized Accounts</div>
                    <div className="font-mono-tabular text-slate-400">
                      {ALLOWED_SONGBOOK_EMAILS.join(' · ')}
                    </div>
                  </div>

                  {authError && (
                    <div className="rounded-lg bg-red-950/40 border border-red-900/60 px-3 py-2.5 flex items-start gap-2 text-xs text-red-300">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2 rounded-lg bg-[#252a33] hover:bg-[#303642] text-xs font-medium text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onSignIn}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign in with ET OAuth</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
