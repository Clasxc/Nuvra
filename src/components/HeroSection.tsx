import { cn } from "@/lib/utils";
import FadeInSection from "./FadeInSection";
import { useNavigate } from "react-router-dom";
import { Sparkles, Brain, Target, BookOpen, Zap, ArrowRight } from "lucide-react";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden bg-white"
    >
      {/* Decorative gradient mesh background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 -left-20 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[600px] h-[600px] bg-purple-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-amber-100/30 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* ── Left: Copy ────────────────────────────────────── */}
          <div>
            <FadeInSection>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-white border border-indigo-200 px-4 py-1.5 rounded-full shadow-sm mb-6">
                <Sparkles className="w-3.5 h-3.5 text-sat-primary" />
                <span className="text-xs font-semibold text-sat-primary tracking-wide">
                  AI grounded in your tutor's materials
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-[1.05] tracking-tight">
                The AI Tutor that <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                  actually knows
                </span>{" "}
                <br />
                your course.
              </h1>

              <p className="text-lg text-gray-600 mb-8 max-w-lg leading-relaxed">
                NUVRA turns your tutor's real lessons into a personalized AI — one that
                explains your specific mistakes, adapts to how you learn, and helps
                tutors see exactly where the class is struggling.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate("/signup")}
                  className={cn(
                    "group inline-flex items-center justify-center gap-2 px-7 py-3.5",
                    "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl",
                    "font-semibold shadow-lg shadow-indigo-200/60",
                    "hover:shadow-xl hover:shadow-indigo-300/60 hover:-translate-y-0.5",
                    "transition-all"
                  )}
                >
                  Get started free
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={() => navigate("/courses")}
                  className={cn(
                    "px-7 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl",
                    "font-semibold hover:border-indigo-300 hover:bg-indigo-50/50",
                    "transition-colors"
                  )}
                >
                  Explore courses
                </button>
              </div>

              {/* Trust strip */}
              <div className="mt-10 flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Live AI-grounded answers</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                  <span>3 roles · 1 platform</span>
                </div>
              </div>
            </FadeInSection>
          </div>

          {/* ── Right: Product-feature mockup ────────────────── */}
          <div className="relative">
            <FadeInSection delay={200}>
              {/* Main "AI conversation" card */}
              <div className="relative bg-white rounded-3xl shadow-2xl shadow-indigo-200/40 border border-gray-100 overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
                  <p className="text-xs text-gray-400 ml-3 font-mono">nuvra · AI Assistant</p>
                </div>

                <div className="p-6 space-y-4">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-sat-primary text-white px-4 py-2.5 rounded-2xl rounded-br-md text-sm">
                      What's a comma splice, and how do I fix it?
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex">
                    <div className="max-w-[90%] bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-md text-sm space-y-2">
                      <p className="text-gray-800">
                        A comma splice joins two independent clauses with only a comma. Fix it
                        with a semicolon, a FANBOYS conjunction, or by making it two sentences.
                      </p>
                      <div className="flex items-center gap-1.5 pt-2 border-t border-gray-200/70">
                        <BookOpen className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          Cited from <span className="font-medium">Punctuation_Rules.pdf</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating feature pills */}
              <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex items-center gap-2.5 hidden sm:flex">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">Personalized Focus</p>
                  <p className="text-[10px] text-gray-500">Based on your last quiz</p>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-6 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex items-center gap-2.5 hidden sm:flex">
                <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">Adaptive Practice</p>
                  <p className="text-[10px] text-gray-500">AI tunes difficulty live</p>
                </div>
              </div>

              <div className="absolute top-1/2 -right-8 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex items-center gap-2 hidden md:flex">
                <Zap className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-semibold text-gray-900">Live feedback</p>
              </div>
            </FadeInSection>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
