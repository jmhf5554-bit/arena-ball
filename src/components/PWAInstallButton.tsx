import React, { useState } from 'react';
import { Download, Smartphone, Check, Copy, X } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';
import { soundEngine } from '../utils/audio';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'card' }> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled) {
    return null;
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleClick = async () => {
    soundEngine.playClick();
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
    }
    setShowGuide(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {variant === 'compact' ? (
        <button
          onClick={handleClick}
          title="Colocar na Tela Inicial (Instalar App)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tela Inicial</span>
        </button>
      ) : (
        <button
          onClick={handleClick}
          className="w-full py-3 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-between text-xs font-bold text-white cursor-pointer transition-colors"
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            Adicionar na Tela Inicial (Instalar como App)
          </span>
          <span className="text-emerald-300">{isInstallable ? 'INSTALAR' : 'COMO FAZER'}</span>
        </button>
      )}

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#111D16] border border-emerald-500/35 p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-extrabold text-white leading-none">
                    Colocar na Tela Inicial
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Jogue abrindo direto pelo ícone, como um aplicativo!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {appUrl && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono-tabular text-emerald-300 truncate">{appUrl}</span>
                <button
                  onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar Link'}
                </button>
              </div>
            )}

            <div className="space-y-2.5 text-xs text-slate-200 leading-relaxed">
              {isIOS ? (
                <div className="p-3.5 rounded-xl bg-black/35 border border-white/10 space-y-1.5">
                  <div className="font-bold text-emerald-300">No iPhone / iPad (Safari):</div>
                  <p>1. Abra o link do jogo fora do editor, direto no navegador <strong>Safari</strong>.</p>
                  <p>2. Toque no botão <strong>Compartilhar</strong> (quadrado com seta para cima).</p>
                  <p>3. Role e toque em <strong>Adicionar à Tela de Início</strong> → <strong>Adicionar</strong>.</p>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-black/35 border border-white/10 space-y-1.5">
                    <div className="font-bold text-emerald-300">No Celular Android (Chrome):</div>
                    <p>1. Abra o link do jogo em uma aba normal do <strong>Google Chrome</strong>.</p>
                    <p>2. Toque nos <strong>3 pontinhos (⋮)</strong> no canto superior direito.</p>
                    <p>3. Toque em <strong>Adicionar à tela inicial</strong> ou <strong>Instalar aplicativo</strong>.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/35 border border-white/10 space-y-1.5">
                    <div className="font-bold text-sky-300">No Computador (Chrome ou Edge):</div>
                    <p>1. Abra o link do jogo em uma aba normal.</p>
                    <p>2. Clique no ícone de <strong>Instalar</strong> na barra de endereço (ou Menu ⋮ → <strong>Salvar e compartilhar → Instalar página como app</strong>).</p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-lg">
      <span className="h-2 w-2 rounded-full bg-slate-950 animate-pulse" />
      Modo Offline · Usando dados salvos
    </div>
  );
};
