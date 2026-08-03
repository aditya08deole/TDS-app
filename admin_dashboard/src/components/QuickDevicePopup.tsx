import { Star, ShieldCheck, MapPin, Activity } from 'lucide-react';
import { LiquidModal } from './LiquidModal';
import { LiquidPopupCard } from './LiquidPopupCard';

interface QuickDevicePopupProps {
  isOpen: boolean;
  onClose: () => void;
  device?: {
    id: string;
    name: string;
    location_name: string;
    last_tds: number;
    status: 'online' | 'offline' | 'critical';
  };
}

/**
 * Feature Demonstration Popup Card
 * Modeled directly after the middle screen in the reference UI:
 * - Asymmetric rounded header card (`rounded-b-[2.5rem]`)
 * - Star rating & experience metrics tags
 * - Sleek glass description text
 * - Full-width vibrant liquid pill action button (`Make an Appointment` / `Calibrate Device`)
 */
export function QuickDevicePopup({ isOpen, onClose, device }: QuickDevicePopupProps) {
  const deviceName = device?.name || 'Dr. Hannah Franklin';
  const location = device?.location_name || 'General Hospital, New York';
  const tds = device?.last_tds ?? 184;
  const status = device?.status || 'online';

  return (
    <LiquidModal isOpen={isOpen} onClose={onClose} mode="floating" maxWidth="md">
      <div className="-m-6 md:-m-8">
        {/* ── Asymmetric Liquid Header Card ── */}
        <LiquidPopupCard mode="header" hover={false} className="bg-gradient-to-b from-cyan-600/30 via-blue-600/20 to-slate-950/80 border-b border-white/20 p-8 pb-10">
          <div className="flex justify-between items-start mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>{status.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-amber-400 text-xs font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>4.9</span>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
            {deviceName}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-cyan-200/80 mt-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{location}</span>
          </div>

          {/* Metric Tags */}
          <div className="flex items-center gap-3 mt-6">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2.5 text-center">
              <span className="block text-lg font-black text-cyan-300 leading-none">{tds}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1 block">TDS PPM</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2.5 text-center">
              <span className="block text-lg font-black text-blue-300 leading-none">99.4%</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1 block">Uptime</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2.5 text-center">
              <span className="block text-lg font-black text-emerald-300 leading-none">Healthy</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1 block">Filter Tier</span>
            </div>
          </div>
        </LiquidPopupCard>

        {/* ── Body Content ── */}
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Operational Summary</h4>
            <p className="text-sm text-foreground/80 leading-relaxed font-normal">
              Autonomous TDS sensor node operational with continuous polling. Water purity telemetry is within designated parameters. Next maintenance check recommended in 14 days.
            </p>
          </div>

          {/* ── Full Capsule Liquid Pill Action Button ── */}
          <button
            type="button"
            onClick={onClose}
            className="w-full liquid-pill-button py-4 text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Calibrate & Calibrate Node</span>
          </button>
        </div>
      </div>
    </LiquidModal>
  );
}
