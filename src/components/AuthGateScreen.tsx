import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Search,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { JogadorProfile, Team } from '../types/game';
import { ClubCrest } from './ClubCrest';
import { soundEngine } from '../utils/audio';
import {
  isSupabaseConfigured,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  SUPABASE_URL,
} from '../utils/supabaseClient';

interface AuthGateScreenProps {
  allTeamsAndNations: Team[];
  onAuthenticated: (profile: JogadorProfile) => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  allTeamsAndNations,
  onAuthenticated,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [favoriteId, setFavoriteId] = useState(allTeamsAndNations[0]?.id || 'fla');
  const [searchTeam, setSearchTeam] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabaseReady = isSupabaseConfigured();

  const filteredTeams = useMemo(() => {
    const q = searchTeam.trim().toLowerCase();
    if (!q) return allTeamsAndNations;
    return allTeamsAndNations.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.shortCode.toLowerCase().includes(q)
    );
  }, [allTeamsAndNations, searchTeam]);

  const selectedTeam =
    allTeamsAndNations.find((t) => t.id === favoriteId) || allTeamsAndNations[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!supabaseReady) {
      setErrorMsg(
        'Configure a chave pública VITE_SUPABASE_ANON_KEY nas variáveis do projeto (AI Studio Secrets / Vercel) para conectar ao Supabase.'
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Digite um endereço de e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (tab === 'register' && nome.trim().length < 2) {
      setErrorMsg('Digite seu nome de jogador com pelo menos 2 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        const res = await signInWithEmailPassword({ email: cleanEmail, password });
        if (res.error || !res.profile) {
          setErrorMsg(res.error || 'Não foi possível entrar na sua conta.');
          return;
        }
        soundEngine.playTransferSuccess();
        onAuthenticated(res.profile);
      } else {
        const res = await signUpWithEmailPassword({
          email: cleanEmail,
          password,
          nome: nome.trim(),
          timeFavoritoId: favoriteId,
        });
        if (res.error || !res.profile) {
          setErrorMsg(res.error || 'Não foi possível criar sua conta.');
          return;
        }
        soundEngine.playTransferSuccess();
        onAuthenticated(res.profile);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#07100A] text-slate-100 flex items-center justify-center p-3 sm:p-6 overflow-y-auto safe-area-hud">
      <div className="w-full max-w-lg bg-[#111D16] border border-emerald-500/35 rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.75)] overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 sm:px-6 py-5 bg-[#0D1812] border-b border-white/10 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-400 mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-wide leading-none">
            ARENA BOLA 2027
          </h1>
          <p className="text-xs text-slate-300">
            Entre com seu e-mail e senha para acessar sua conta, salvar seu progresso e jogar online.
          </p>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {!supabaseReady && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Conexão Supabase pendente de chave pública
              </div>
              <p className="leading-relaxed">
                Defina <code className="px-1 py-0.5 rounded bg-black/40">VITE_SUPABASE_ANON_KEY</code> nas variáveis de ambiente do projeto (projeto <code className="px-1 py-0.5 rounded bg-black/40">{SUPABASE_URL}</code>) e execute o script <code className="px-1 py-0.5 rounded bg-black/40">supabase/schema.sql</code> no SQL Editor do Supabase.
              </p>
            </div>
          )}

          {/* Switch Login / Register */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/45 border border-white/10">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setTab('login');
                setErrorMsg(null);
              }}
              className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                tab === 'login' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setTab('register');
                setErrorMsg(null);
              }}
              className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                tab === 'register' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Criar Conta
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            {tab === 'register' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Nome de Jogador (Apelido)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    maxLength={28}
                    placeholder="Ex: João Silva"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-black/45 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-black/45 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Senha (mín. 6 caracteres)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-black/45 border border-white/15 text-sm text-white focus:border-emerald-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {tab === 'register' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
                    <ClubCrest team={selectedTeam} size={18} /> Clube ou Seleção Favorita
                  </label>
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTeam}
                      onChange={(e) => setSearchTeam(e.target.value)}
                      placeholder="Buscar time..."
                      className="pl-7 pr-2.5 py-1 rounded-lg bg-black/45 border border-white/15 text-xs text-white outline-none focus:border-emerald-400 w-36"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {filteredTeams.map((t) => {
                    const active = t.id === favoriteId;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => {
                          soundEngine.playClick();
                          setFavoriteId(t.id);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-400 text-white'
                            : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <ClubCrest team={t} size={22} />
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold truncate">{t.name}</div>
                          <div className="text-[10px] text-slate-400">{t.shortCode}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="text-xs text-rose-200 bg-rose-500/15 border border-rose-500/35 rounded-xl px-3.5 py-2.5">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-display text-xl font-extrabold tracking-wide cursor-pointer transition-colors"
            >
              {loading
                ? 'CONECTANDO...'
                : tab === 'login'
                  ? 'ENTRAR NO JOGO'
                  : 'CRIAR CONTA E ENTRAR'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
