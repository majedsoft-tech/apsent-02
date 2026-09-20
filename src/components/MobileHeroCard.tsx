import React from "react";
import { Plus, Sparkles, ClipboardCheck, Clock, Users, ArrowLeft } from "lucide-react";

interface MobileHeroCardProps {
  title: string;
  subtitle: string;
  buttonText: string;
  onButtonClick: () => void;
  buttonIcon?: React.ReactNode;
}

export default function MobileHeroCard({
  title,
  subtitle,
  buttonText,
  onButtonClick,
  buttonIcon
}: MobileHeroCardProps) {
  return (
    <div className="md:hidden bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs text-center space-y-4 animate-in fade-in" dir="rtl">
      <div className="space-y-1.5 pt-1">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          {title}
        </h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
          {subtitle}
        </p>
      </div>

      {/* Prominent Golden Action Button (Exact Match to Screenshot) */}
      <button
        type="button"
        onClick={onButtonClick}
        className="w-full py-3.5 px-4 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-400/20 transition-all cursor-pointer select-none active:scale-[0.98]"
      >
        {buttonIcon || <Plus className="w-5 h-5 stroke-[2.5]" />}
        <span>{buttonText}</span>
      </button>
    </div>
  );
}
