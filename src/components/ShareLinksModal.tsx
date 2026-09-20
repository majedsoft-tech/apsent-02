import React from "react";
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  ClipboardCheck, 
  Clock, 
  BarChart3, 
  Share2, 
  Smartphone
} from "lucide-react";

interface ShareLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName: string;
  schoolCode?: string;
  onCopyTeacherLink: () => void;
  teacherCopied: boolean;
  onCopyDelayLink: () => void;
  delayCopied: boolean;
  onCopyStatsLink: () => void;
  statsCopied: boolean;
  onCopyAdminSyncLink?: () => void;
  adminSyncCopied?: boolean;
  onSyncCloudData?: () => Promise<void>;
  isSyncingCloud?: boolean;
  syncCloudSuccess?: boolean;
  isGoogleAuthenticated?: boolean;
  onGoogleLogin?: () => void;
  onDownloadBackup?: () => void;
  onUploadBackup?: (file: File) => void;
  onOpenCloudDiagnostics?: () => void;
}

export default function ShareLinksModal({
  isOpen,
  onClose,
  schoolName,
  schoolCode,
  onCopyTeacherLink,
  teacherCopied,
  onCopyDelayLink,
  delayCopied,
  onCopyStatsLink,
  statsCopied
}: ShareLinksModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-right animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-xs">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black">مشاركة روابط النظام</h3>
              <p className="text-[11px] text-blue-100 font-medium">
                {schoolName ? `بوابة ${schoolName}` : "روابط سريعة ومباشرة للمشرفين والمعلمين"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {schoolCode && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-bold text-emerald-950">معرّف المدرسة المرتبط:</span>
                <code className="bg-white px-2 py-0.5 rounded-lg border border-emerald-200 font-mono font-bold text-emerald-800 text-[11px]">{schoolCode}</code>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold">مزامنة نشطة</span>
            </div>
          )}

          <p className="text-xs text-slate-700 font-bold leading-relaxed">
            جميع الروابط أدناه مربوطة تلقائياً بمعرف مدرستكم، بحيث يظهر أي غياب أو تأخير مسجل فوراً في لوحة التحكم الرئيسية ومتابعة النسب:
          </p>

          {/* 1. Teachers Attendance Link */}
          <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-purple-950">رابط المعلمين (الغياب والسلوك)</h4>
                  <p className="text-[10px] text-purple-700 font-bold">لرصد حضور الحصص والمخالفات المدرسية</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onCopyTeacherLink}
              className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-purple-100/50 border border-purple-300 text-purple-900 rounded-xl text-xs font-black transition shadow-3xs cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-purple-600" />
                <span>نسخ الرابط المباشر للمعلمين</span>
              </div>
              {teacherCopied ? (
                <span className="text-emerald-600 flex items-center gap-1 text-[11px] font-black">
                  <Check className="w-3.5 h-3.5" /> تم النسخ
                </span>
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>

          {/* 2. Morning Delay Link */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-950">رابط تسجيل التأخر الصباحي</h4>
                  <p className="text-[10px] text-amber-700 font-bold">لمشرفي الطابور والبوابة الصباحية</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onCopyDelayLink}
              className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-amber-100/50 border border-amber-300 text-amber-900 rounded-xl text-xs font-black transition shadow-3xs cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-amber-600" />
                <span>نسخ الرابط لمشرف التأخر</span>
              </div>
              {delayCopied ? (
                <span className="text-emerald-600 flex items-center gap-1 text-[11px] font-black">
                  <Check className="w-3.5 h-3.5" /> تم النسخ
                </span>
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>

          {/* 3. Admin / Stats Link */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-blue-950">رابط لوحة المتابعة والإحصائيات</h4>
                  <p className="text-[10px] text-blue-700 font-bold">لمدير المدرسة ووكيل شؤون الطلاب</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onCopyStatsLink}
              className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-blue-100/50 border border-blue-300 text-blue-900 rounded-xl text-xs font-black transition shadow-3xs cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-blue-600" />
                <span>نسخ الرابط المباشر للمسؤول</span>
              </div>
              {statsCopied ? (
                <span className="text-emerald-600 flex items-center gap-1 text-[11px] font-black">
                  <Check className="w-3.5 h-3.5" /> تم النسخ
                </span>
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
            <span>متوافق كلياً مع الجوال والكمبيوتر</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black cursor-pointer transition"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
}

