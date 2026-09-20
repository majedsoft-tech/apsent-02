import React, { useState, useEffect } from "react";
import { 
  Cloud, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck, 
  Database, 
  Globe, 
  ArrowRightLeft, 
  X,
  FileCode
} from "lucide-react";
import { 
  runComprehensiveCloudDiagnostics, 
  CloudDiagnosticDetails, 
  switchDatabaseIdAndReload,
  getActiveFirestoreDatabaseId 
} from "../dbService";

interface FirebaseDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerSync?: () => void;
}

export const FirebaseDiagnosticModal: React.FC<FirebaseDiagnosticModalProps> = ({
  isOpen,
  onClose,
  onTriggerSync
}) => {
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<CloudDiagnosticDetails | null>(null);
  const [customInputId, setCustomInputId] = useState("");
  const [copiedRules, setCopiedRules] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const activeId = getActiveFirestoreDatabaseId();

  const runDiagnostics = async (customId?: string) => {
    setLoading(true);
    try {
      const res = await runComprehensiveCloudDiagnostics(customId || customInputId);
      setDiagnostics(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const rulesSnippet = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // السماح بالقراءة والكتابة للمزامنة المدرسية الموحدة
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  const copyRulesToClipboard = () => {
    navigator.clipboard.writeText(rulesSnippet);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  const copyDomainToClipboard = () => {
    navigator.clipboard.writeText("apsents.vercel.app");
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2500);
  };

  const handleApplyNewDbId = (newId: string) => {
    if (!newId || !newId.trim()) return;
    switchDatabaseIdAndReload(newId.trim());
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fadeIn font-sans">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">تشخيص وخصائص قاعدة البيانات السحابية</h3>
              <p className="text-xs text-slate-500">مشروع Firebase الحالي: <span className="font-mono font-bold text-blue-700">apsent-02</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right" dir="rtl">
          
          {/* Status Diagnostic Card */}
          <div className={`p-4 rounded-xl border ${
            loading 
              ? "bg-slate-50 border-slate-200 text-slate-700" 
              : diagnostics?.ok 
                ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
                : "bg-amber-50 border-amber-200 text-amber-900"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {loading ? (
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0 mt-0.5" />
                ) : diagnostics?.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {loading 
                      ? "جاري فحص الاتصال ومسح قواعد البيانات..." 
                      : diagnostics?.ok 
                        ? "الاتصال السحابي يعمل ومكتمل 100% ✅" 
                        : "حالة الربط والمزامنة: بحاجة لضبط بعض الخصائص ⚠️"}
                  </h4>
                  <p className="text-xs mt-1 whitespace-pre-line leading-relaxed opacity-90">
                    {loading ? "يتم الآن اختبار الاتصال بقاعدة البيانات وفحص الصلاحيات..." : diagnostics?.message}
                  </p>

                  {/* If a working alternate database was detected, offer 1-click switch */}
                  {diagnostics?.suggestedDbId && (
                    <div className="mt-3 p-3 bg-white/90 rounded-lg border border-emerald-300 flex items-center justify-between gap-2">
                      <div className="text-xs text-emerald-800 font-medium">
                        ✨ تم اكتشاف أن قاعدة البيانات <span className="font-mono font-bold bg-emerald-100 px-1.5 py-0.5 rounded">{diagnostics.suggestedDbId}</span> موجودة وتعمل!
                      </div>
                      <button
                        onClick={() => handleApplyNewDbId(diagnostics.suggestedDbId!)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        تفعيلها الآن
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => runDiagnostics()}
                disabled={loading}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                إعادة الفحص
              </button>
            </div>
          </div>

          {/* Core Database Properties Section */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <Database className="w-4 h-4 text-blue-600" />
              خصائص قاعدة البيانات التي أنشأتها في Firebase:
            </h4>

            {/* Property 1: Database ID */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700">1. معرّف قاعدة البيانات (Database ID):</span>
                <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                  النشط حالياً: {activeId}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                عند إنشاء قاعدة بيانات جديدة، يعطيها Firebase افتراضياً الاسم <code className="bg-slate-200 px-1 rounded font-bold">(default)</code>. إذا كنت قد سميتها باسم مشروعك <code className="bg-slate-200 px-1 rounded font-bold">apsent-02</code> أو أي اسم آخر، اختره من هنا للربط المباشر:
              </p>
              
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => handleApplyNewDbId("(default)")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                    activeId === "(default)"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  استخدام (default)
                  {diagnostics?.defaultDbResult.ok && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                <button
                  onClick={() => handleApplyNewDbId("apsent-02")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                    activeId === "apsent-02"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  استخدام apsent-02
                  {diagnostics?.projectNamedDbResult?.ok && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={customInputId}
                    onChange={(e) => setCustomInputId(e.target.value)}
                    placeholder="أو اكتب اسم مخصص..."
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleApplyNewDbId(customInputId)}
                    disabled={!customInputId.trim()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shrink-0"
                  >
                    تطبيق
                  </button>
                </div>
              </div>
            </div>

            {/* Property 2: Security Rules */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  2. قواعد الأمان (Firestore Rules):
                </span>
                <a
                  href="https://console.firebase.google.com/project/apsent-02/firestore/rules"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 hover:underline"
                >
                  فتح تبويب Rules في Firebase
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                إذا كانت القواعد مضبوطة على <code className="bg-red-100 text-red-700 px-1 rounded font-mono font-bold">allow read, write: if false;</code> (وضع الإنتاج الافتراضي)، فلن يُسمح للتطبيق بالمزامنة. انسخ القواعد التالية وألصقها في تبويب <strong className="text-slate-700">Rules</strong> ثم اضغط <strong className="text-slate-700">Publish</strong>:
              </p>

              <div className="relative">
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto text-left" dir="ltr">
                  {rulesSnippet}
                </pre>
                <button
                  onClick={copyRulesToClipboard}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-medium backdrop-blur-sm transition-colors flex items-center gap-1.5 border border-white/20"
                >
                  {copiedRules ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedRules ? "تم النسخ!" : "نسخ القواعد"}
                </button>
              </div>
            </div>

            {/* Property 3: Database Mode */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700">3. وضع قاعدة البيانات (Database Mode):</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  المطلوب: Firestore Native Mode
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                تأكد أن قاعدة البيانات منشأة بالوضع الأصلي <strong className="text-slate-700">Firestore in Native mode</strong> وليس وضع Datastore. إذا كانت بالوضع الأصلي فهي متوافقة تماماً.
              </p>
            </div>

            {/* Property 4: Authorized Domains */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  4. النطاقات المصرح بها (Authorized Domains):
                </span>
                <a
                  href="https://console.firebase.google.com/project/apsent-02/authentication/settings"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 hover:underline"
                >
                  فتح صفحة Settings في Firebase
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                لكي يعمل تسجيل الدخول بحساب Google على موقعك في Vercel، افتح <strong className="text-slate-700">Authentication &gt; Settings &gt; Authorized domains</strong> وأضف النطاق التالي:
              </p>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-mono text-xs text-slate-800 flex-1 text-left px-2" dir="ltr">
                  apsents.vercel.app
                </span>
                <button
                  onClick={copyDomainToClipboard}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors flex items-center gap-1"
                >
                  {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedDomain ? "تم النسخ" : "نسخ النطاق"}
                </button>
              </div>
            </div>

          </div>

          {/* Quick Firebase Console Link Banner */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl text-white flex items-center justify-between gap-3 shadow-md">
            <div>
              <h5 className="font-bold text-sm">فتح كونسول Firebase مباشرة لمشروع apsent-02</h5>
              <p className="text-xs text-blue-100 mt-0.5">يمكنك الاطلاع على قاعدة البيانات أو إنشائها وتعديل الخصائص في ثوانٍ.</p>
            </div>
            <a
              href="https://console.firebase.google.com/project/apsent-02/firestore"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              فتح Firebase
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors"
          >
            إغلاق النافذة
          </button>

          {onTriggerSync && (
            <button
              onClick={() => {
                onTriggerSync();
                onClose();
              }}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Cloud className="w-4 h-4" />
              بدء المزامنة السحابية الآن
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
