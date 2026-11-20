import React from 'react';
import { Player, Team } from '../types/game';
import { ClubCrest } from './ClubCrest';

interface PlayerCardProps {
  player: Player;
  team: Team;
  selected?: boolean;
  compact?: boolean;
  badgeLabel?: string;
  onClick?: () => void;
}

export function getFullCardStats(player: Player) {
  const dri = Math.min(99, Math.round(player.pace * 0.45 + player.pass * 0.55));
  const def =
    typeof player.def === 'number'
      ? player.def
      : player.position === 'GOL'
        ? Math.min(99, player.ovr + 4)
        : player.position === 'ZAG'
          ? Math.min(99, player.ovr + 2)
          : player.position === 'MEI'
            ? Math.max(60, player.ovr - 10)
            : Math.max(55, player.ovr - 20);
  const fis =
    typeof player.fis === 'number'
      ? player.fis
      : Math.min(
          97,
          Math.round(player.ovr * 0.86 + (player.position === 'ZAG' || player.position === 'GOL' ? 10 : 5))
        );
  return {
    VEL: player.pace,
    CHU: player.shot,
    PAS: player.pass,
    DRI: dri,
    DEF: def,
    FIS: fis,
  };
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  team,
  selected = false,
  compact = false,
  badgeLabel,
  onClick,
}) => {
  const stats = getFullCardStats(player);
  const isSpecial = player.ovr >= 88;
  const isGold = player.ovr >= 80 && player.ovr < 88;
  const staminaPct = typeof player.stamina === 'number' ? Math.max(0, Math.min(100, Math.round(player.stamina))) : null;

  const cardBg = isSpecial
    ? 'from-[#2A1F0A] via-[#1B2B1F] to-[#0D1612] border-amber-400/75'
    : isGold
      ? 'from-[#2A230D] via-[#1A2419] to-[#0D1612] border-amber-300/45'
      : 'from-[#1B2420] via-[#121C17] to-[#0B120E] border-slate-400/35';

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl border-2 bg-gradient-to-b ${cardBg} p-3.5 shadow-xl transition-transform ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${selected ? 'ring-2 ring-emerald-400 scale-[1.02]' : ''}`}
    >
      {badgeLabel && (
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-1.5">
          {badgeLabel}
        </div>
      )}

      {/* Top Row: OVR + POS + Club Crest */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col items-center leading-none">
          <span className="font-display text-3xl sm:text-4xl font-extrabold text-amber-300 tabular-nums">
            {player.ovr}
          </span>
          <span className="text-[11px] font-bold text-slate-300 tracking-wider mt-0.5">
            {player.position}
          </span>
          <span className="text-[10px] font-mono-tabular text-slate-400 mt-0.5">
            {player.nationality}
          </span>
        </div>

        {/* Center Jersey Disc Avatar */}
        <div className="flex flex-col items-center justify-center my-1">
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-3 flex items-center justify-center shadow-lg font-display text-2xl font-extrabold"
            style={{
              backgroundColor: team.kit.primaryColor,
              borderColor: team.kit.secondaryColor,
              color: team.kit.textColor === '#111111' ? '#FFFFFF' : team.kit.textColor,
            }}
          >
            {player.number}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <ClubCrest team={team} size={32} />
          <span className="text-[10px] font-mono-tabular text-emerald-400 font-bold">
            €{player.valueMillions}M
          </span>
        </div>
      </div>

      {/* Player Name */}
      <div className="mt-2 pt-1.5 border-t border-white/10 text-center">
        <div className="font-display text-lg font-extrabold text-white tracking-wide truncate">
          {player.shortName.toUpperCase()}
        </div>
        {!compact && (
          <div className="text-[10px] text-slate-400 truncate">
            {team.name} · {player.age} anos
          </div>
        )}
      </div>

      {/* 6 FIFA Card Attributes */}
      <div className="mt-2.5 grid grid-cols-3 gap-x-2 gap-y-1 text-[11px] font-mono-tabular bg-black/35 rounded-xl p-2 border border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">VEL</span>
          <span className="font-bold text-white">{stats.VEL}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">CHU</span>
          <span className="font-bold text-amber-300">{stats.CHU}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">PAS</span>
          <span className="font-bold text-white">{stats.PAS}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">DRI</span>
          <span className="font-bold text-white">{stats.DRI}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">DEF</span>
          <span className="font-bold text-slate-200">{stats.DEF}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">FIS</span>
          <span className="font-bold text-slate-200">{stats.FIS}</span>
        </div>
      </div>

      {staminaPct !== null && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] font-mono-tabular mb-0.5">
            <span className="text-slate-400">Energia (FIS)</span>
            <span
              className={
                staminaPct >= 70
                  ? 'text-emerald-400 font-bold'
                  : staminaPct >= 45
                    ? 'text-amber-300 font-bold'
                    : 'text-rose-400 font-bold'
              }
            >
              {staminaPct}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/50 overflow-hidden">
            <div
              className={`h-full transition-all ${
                staminaPct >= 70 ? 'bg-emerald-500' : staminaPct >= 45 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
              style={{ width: `${staminaPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
