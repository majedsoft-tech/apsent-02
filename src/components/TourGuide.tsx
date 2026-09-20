import React, { useState, useEffect, useRef } from "react";
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  HelpCircle, 
  Sparkles,
  Award
} from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right";
  onBeforeStep?: () => void | Promise<void>;
}

interface TourGuideProps {
  isOpen: boolean;
  onClose: () => void;
  appMode: "teacher" | "admin" | "stats-only" | "super-admin";
  setAppMode: (mode: "teacher" | "admin" | "stats-only" | "super-admin") => void;
  setAdminTab: (tab: "stats" | "grades" | "teachers" | "students") => void;
  setTeacherTab: (tab: "attendance" | "behavior") => void;
  setIsSidebarOpen: (open: boolean) => void;
}

export default function TourGuide({
  isOpen,
  onClose,
  appMode,
  setAppMode,
  setAdminTab,
  setTeacherTab,
  setIsSidebarOpen
}: TourGuideProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [, setWindowSize] = useState({ width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const prevElementRef = useRef<HTMLElement | null>(null);
  const originalStylesRef = useRef<{
    position: string;
    zIndex: string;
    pointerEvents: string;
    backgroundColor: string;
  } | null>(null);

  // Helper to safely clean up styles on the previously focused element
  const cleanupPrevElement = () => {
    if (prevElementRef.current && originalStylesRef.current) {
      prevElementRef.current.style.position = originalStylesRef.current.position;
      prevElementRef.current.style.zIndex = originalStylesRef.current.zIndex;
      prevElementRef.current.style.pointerEvents = originalStylesRef.current.pointerEvents;
      prevElementRef.current.style.backgroundColor = originalStylesRef.current.backgroundColor;
      prevElementRef.current.classList.remove("tour-highlighted-element");
    }
    prevElementRef.current = null;
    originalStylesRef.current = null;
  };

  // Define the interactive onboarding steps
  const steps: TourStep[] = [
    {
      target: "#sidebar-school-logo",
      title: "مرحباً بك في نظام مدرستك الذكية 🏫",
      content: "أهلاً بك! دعنا نأخذك في جولة تفاعلية سريعة مدتها دقيقة واحدة للتعرف على وظائف النظام وكيفية استخدامه بالشكل الأمثل.",
      placement: "left"
    },
    {
      target: "#btn-edit-school",
      title: "تعديل اسم المدرسة ✏️",
      content: "من هنا يمكنك الضغط على زر التعديل الأحمر لكتابة اسم مدرستك الحقيقي وتغييره، وسيتم حفظه فوراً في قاعدة البيانات وتحديثه لكافة الكادر التعليمي والزوار.",
      placement: "left"
    },
    {
      target: "#sidebar-students",
      title: "إضافة الصفوف، الفصول، والطلاب 👥",
      content: "هنا تبدأ خطوتك الأولى! قبل أي شيء، ادخل هنا لإضافة الصفوف (مثل الأول، الثاني...) ثم الفصول، ثم قم برفع أسماء طلابك دفعة واحدة أو إدخالهم يدوياً وبسهولة بالغة.",
      placement: "left",
      onBeforeStep: () => {
        setIsSidebarOpen(true);
        setAppMode("admin");
        setAdminTab("students");
      }
    },
    {
      target: "#sidebar-teachers",
      title: "إسناد الفصول للمعلمين والوكلاء 💼",
      content: "بعد رفع الطلاب، توجه إلى هذا القسم لإضافة المعلمين والمعلمات وتعيين الفصول الخاصة بكل معلم، ليتمكن كل منهم من تحضير طلابه الخاصين به فقط.",
      placement: "left",
      onBeforeStep: () => {
        setIsSidebarOpen(true);
        setAppMode("admin");
        setAdminTab("teachers");
      }
    },
    {
      target: "#btn-copy-teacher-link",
      title: "بوابة المعلمين ونسخ رابط التحضير 🔗",
      content: "من هنا يمكنك نسخ الرابط المباشر لبوابة تسجيل الغياب والسلوك وتوزيعه على المعلمين والمعلمات (عبر الواتساب مثلاً). سيمكنهم هذا الرابط من رصد غياب وسلوك طلابهم بشكل مباشر وسريع وبأعلى درجات الخصوصية والأمان دون الحاجة لتسجيل دخولهم للنظام.",
      placement: "left",
      onBeforeStep: () => {
        setIsSidebarOpen(true);
        setAppMode("admin");
        setAdminTab("stats");
      }
    },
    {
      target: "#sidebar-stats",
      title: "إحصائيات وتقارير الإدارة والمتابعة 📊",
      content: "لوحة ذكية وحية تجمع كافة البيانات تلقائياً وتفرزها لعرض نسب الغياب اليومية، السلوكيات المرصودة، الطلاب الأكثر تكراراً للغياب، ورسوم بيانية تفاعلية متكاملة.",
      placement: "left",
      onBeforeStep: () => {
        setIsSidebarOpen(true);
        setAppMode("admin");
        setAdminTab("stats");
      }
    },
    {
      target: "#btn-copy-stats-link",
      title: "مشاركة رابط الإحصائيات مع الإدارة 🔗",
      content: "يمكنك نسخ رابط المتابعة والإحصائيات وإرساله لمدير المدرسة أو المشرفين لمتابعة الأداء الحي مباشرة دون الحاجة لتسجيل الدخول كأدمن.",
      placement: "bottom",
      onBeforeStep: () => {
        setIsSidebarOpen(true);
        setAppMode("admin");
        setAdminTab("stats");
      }
    }
  ];

  const currentStep = steps[currentStepIdx];

  // Helper to calculate target element bounding rect and dynamically highlight it
  const updateTargetRect = async () => {
    if (!isOpen || !currentStep) {
      cleanupPrevElement();
      return;
    }

    // Run action before step if any
    if (currentStep.onBeforeStep) {
      currentStep.onBeforeStep();
    }

    // Wait slightly for DOM render updates
    setTimeout(() => {
      // Clean up previous element highlight first
      cleanupPrevElement();

      const element = document.querySelector(currentStep.target) as HTMLElement | null;
      if (element) {
        // Scroll target into view
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Wait for scroll completion to get accurate bounding client rect
        setTimeout(() => {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);

          // Save original styles
          const computedStyle = window.getComputedStyle(element);
          originalStylesRef.current = {
            position: element.style.position || computedStyle.position,
            zIndex: element.style.zIndex || computedStyle.zIndex,
            pointerEvents: element.style.pointerEvents || computedStyle.pointerEvents,
            backgroundColor: element.style.backgroundColor || computedStyle.backgroundColor,
          };
          prevElementRef.current = element;

          // Elevate target element above the dimmed backdrop (backdrop zIndex is 9990)
          const currentPosition = computedStyle.position;
          if (currentPosition === "static" || !currentPosition) {
            element.style.position = "relative";
          }
          element.style.zIndex = "9998";
          
          // Prevent dark backdrop from bleeding through elements with transparent backgrounds
          const computedBg = computedStyle.backgroundColor;
          const isTransparent = computedBg === "rgba(0, 0, 0, 0)" || computedBg === "transparent" || !computedBg;
          if (isTransparent) {
            const isDark = document.documentElement.classList.contains("dark") || document.body.classList.contains("dark");
            element.style.backgroundColor = isDark ? "#0f172a" : "#ffffff";
          }

          // Apply styling indicator
          element.classList.add("tour-highlighted-element");
        }, 300);
      } else {
        setTargetRect(null);
      }
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      updateTargetRect();
    } else {
      setTargetRect(null);
      cleanupPrevElement();
    }
  }, [isOpen, currentStepIdx]);

  // Clean up styles on unmount
  useEffect(() => {
    return () => {
      cleanupPrevElement();
    };
  }, []);

  // Monitor window resize or scroll to keep tooltip positioned
  useEffect(() => {
    const handleUpdate = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      if (isOpen && currentStep) {
        const element = document.querySelector(currentStep.target);
        if (element) {
          setTargetRect(element.getBoundingClientRect());
        }
      }
    };

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);
    
    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [isOpen, currentStepIdx]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIdx < steps.length - 1) {
      setCurrentStepIdx(prev => prev + 1);
    } else {
      onClose();
      setCurrentStepIdx(0);
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onClose();
    setCurrentStepIdx(0);
  };

  // Compute tooltip position style based on placement and rect
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      // Fallback to center screen if element not found
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999
      };
    }

    const margin = 12;
    const tooltipWidth = 320;
    const tooltipHeight = 220; // Approximate
    const rect = targetRect;

    let top = 0;
    let left = 0;

    switch (currentStep.placement) {
      case "left":
        // Tooltip is placed on the left of target (Arabic flow)
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - margin;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + margin;
        break;
      case "top":
        top = rect.top - tooltipHeight - margin;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = rect.bottom + margin;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
    }

    // Keep within screen boundaries
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }
    if (top < 10) top = 10;
    if (top + tooltipHeight > window.innerHeight - 10) {
      top = window.innerHeight - tooltipHeight - 10;
    }

    return {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 9999,
      width: `${tooltipWidth}px`
    };
  };

  return (
    <div className="fixed inset-0 z-[9990] overflow-hidden text-right" dir="rtl">
      {/* Dynamic styles to ensure the highlighted element stands out beautifully with glowing borders and smooth scaling */}
      <style>{`
        .tour-highlighted-element {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.5), 0 20px 25px -5px rgba(0, 0, 0, 0.15) !important;
          transform: scale(1.015) !important;
        }
      `}</style>

      {/* High-fidelity Dimmed Backdrop with an SVG cutout spotlight mask */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300" style={{ zIndex: 9991 }}>
        <defs>
          <mask id="spotlight-mask">
            {/* Everything white is fully visible (which means it will be covered by the dark backdrop) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Everything black is fully transparent (which creates the cutout hole to reveal the element below) */}
            {targetRect && (
              <rect
                x={targetRect.left - 4}
                y={targetRect.top - 4}
                width={targetRect.width + 8}
                height={targetRect.height + 8}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* The actual dark backdrop, masked with our spotlight cutout */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.75)"
          mask="url(#spotlight-mask)"
          className="pointer-events-auto cursor-pointer"
          onClick={handleSkip}
        />
      </svg>

      {/* Spotlight Effect Box on target element */}
      {targetRect && (
        <div 
          className="absolute border-2 border-amber-400 bg-white/5 pointer-events-none rounded-xl transition-all duration-300 z-[9995] shadow-[0_0_25px_rgba(245,158,11,0.45)] ring-8 ring-amber-400/20"
          style={{
            top: `${targetRect.top - 4}px`,
            left: `${targetRect.left - 4}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`
          }}
        />
      )}

      {/* Guided Tooltip Card */}
      <div 
        ref={tooltipRef}
        style={getTooltipStyle()}
        className="bg-white border-2 border-amber-400 rounded-2xl p-5 shadow-2xl z-[9999] animate-fadeIn transition-all duration-300 flex flex-col justify-between min-h-[200px]"
      >
        <div className="space-y-3">
          {/* Top header with steps counter */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-1.5 text-slate-800">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <h4 className="text-xs font-black text-slate-800">{currentStep.title}</h4>
            </div>
            <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono">
              {currentStepIdx + 1} / {steps.length}
            </span>
          </div>

          {/* Description Text */}
          <p className="text-xs text-slate-600 font-bold leading-relaxed">
            {currentStep.content}
          </p>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          {/* Skip Button */}
          <button
            type="button"
            onClick={handleSkip}
            className="text-[10px] text-slate-400 hover:text-slate-600 font-extrabold cursor-pointer transition"
          >
            تخطي الجولة
          </button>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1.5">
            {currentStepIdx > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 bg-slate-150 hover:bg-slate-200 text-slate-700 rounded-lg transition active:scale-95 cursor-pointer flex items-center justify-center"
                title="السابق"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            
            <button
              type="button"
              onClick={handleNext}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-black text-xs rounded-xl transition shadow-md shadow-amber-500/10 active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <span>{currentStepIdx === steps.length - 1 ? "إنهاء الجولة 🎓" : "التالي"}</span>
              {currentStepIdx < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
