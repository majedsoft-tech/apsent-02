import React from "react";
import { 
  BarChart3, 
  ClipboardCheck, 
  Clock, 
  Users, 
  Menu, 
  Sparkles, 
  BookOpen, 
  Award,
  Layers
} from "lucide-react";

interface MobileBottomNavProps {
  appMode: "teacher" | "admin" | "stats-only" | "super-admin" | "morning-delay";
  adminTab: "stats" | "grades" | "teachers" | "students";
  teacherTab: "attendance" | "behavior";
  onNavigate: (mode: "teacher" | "admin" | "morning-delay", tab?: any) => void;
  onOpenMenu: () => void;
  todayAbsentCount?: number;
}

export default function MobileBottomNav({
  appMode,
  adminTab,
  teacherTab,
  onNavigate,
  onOpenMenu,
  todayAbsentCount = 0
}: MobileBottomNavProps) {
  const isAttendanceActive = appMode === "teacher" && teacherTab === "attendance";
  const isStatsActive = (appMode === "admin" && adminTab === "stats") || appMode === "stats-only";
  const isStudentsActive = appMode === "admin" && (adminTab === "students" || adminTab === "grades");
  const isDelayActive = appMode === "morning-delay";
  const isBehaviorActive = appMode === "teacher" && teacherTab === "behavior";

  return (
    <nav 
      id="mobile-bottom-nav" 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] px-2 py-1.5 pb-[calc(env(safe-area-inset-bottom,4px)+4px)] flex items-center justify-around"
      dir="rtl"
    >
      {/* 1. Results / Stats Tab (الإحصائيات) */}
      <button
        type="button"
        id="nav-btn-stats"
        onClick={() => onNavigate("admin", "stats")}
        className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
          isStatsActive
            ? "text-blue-600 font-extrabold"
            : "text-slate-500 hover:text-slate-700 font-bold"
        }`}
      >
        <div className="relative mb-0.5">
          <Award className={`w-5 h-5 ${isStatsActive ? "text-blue-600 stroke-[2.5]" : "text-amber-500"}`} />
          {todayAbsentCount > 0 && (
            <span className="absolute -top-1 -right-1.5 bg-rose-500 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
              {todayAbsentCount > 9 ? "+9" : todayAbsentCount}
            </span>
          )}
        </div>
        <span className={`text-[11px] tracking-tight ${isStatsActive ? "text-blue-600 font-black" : "text-slate-600 font-bold"}`}>
          الإحصائيات
        </span>
      </button>

      {/* 2. Attendance / Teacher Tab (التحضير) */}
      <button
        type="button"
        id="nav-btn-attendance"
        onClick={() => onNavigate("teacher", "attendance")}
        className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
          isAttendanceActive
            ? "text-blue-600 font-extrabold"
            : "text-slate-500 hover:text-slate-700 font-bold"
        }`}
      >
        <div className="relative mb-0.5">
          <Layers className={`w-5 h-5 ${isAttendanceActive ? "text-blue-600 stroke-[2.5]" : "text-slate-500"}`} />
        </div>
        <span className={`text-[11px] tracking-tight ${isAttendanceActive ? "text-blue-600 font-black" : "text-slate-600 font-bold"}`}>
          التحضير
        </span>
      </button>

      {/* 3. Morning Delay Tab (التأخر) */}
      <button
        type="button"
        id="nav-btn-delay"
        onClick={() => onNavigate("morning-delay")}
        className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
          isDelayActive
            ? "text-blue-600 font-extrabold"
            : "text-slate-500 hover:text-slate-700 font-bold"
        }`}
      >
        <div className="relative mb-0.5">
          <Sparkles className={`w-5 h-5 ${isDelayActive ? "text-blue-600 stroke-[2.5]" : "text-amber-500"}`} />
        </div>
        <span className={`text-[11px] tracking-tight ${isDelayActive ? "text-blue-600 font-black" : "text-slate-600 font-bold"}`}>
          التأخر
        </span>
      </button>

      {/* 4. More Menu Tab (المزيد) */}
      <button
        type="button"
        id="nav-btn-more"
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer select-none active:scale-95"
      >
        <div className="relative mb-0.5">
          <Menu className="w-5 h-5 text-slate-500" />
        </div>
        <span className="text-[11px] tracking-tight text-slate-600 font-bold">
          المزيد
        </span>
      </button>
    </nav>
  );
}
