// src/pages/Practice.tsx — Adaptive AI practice mode
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  isLoggedIn, getCurrentUser, getCourse, generatePracticeQuestion,
} from "@/lib/api";
import type { Course, User, PracticeQuestion, PracticeHistoryItem } from "@/lib/api";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, XCircle, Flame, ChevronRight, Trophy } from "lucide-react";

const Practice = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const cid = Number(courseId);
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [current, setCurrent] = useState<PracticeQuestion | null>(null);
  const [history, setHistory] = useState<PracticeHistoryItem[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Session stats
  const correct = history.filter(h => h.was_correct).length;
  const total = history.length;
  const streak = (() => {
    let s = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].was_correct) s++;
      else break;
    }
    return s;
  })();
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    Promise.all([getCurrentUser(), getCourse(cid)])
      .then(([u, c]) => {
        setUser(u);
        setCourse(c);
      })
      .catch(() => { toast.error("Could not load course"); navigate(-1); })
      .finally(() => setLoading(false));
  }, [cid]);

  const fetchNext = async () => {
    setGenerating(true);
    setChosen(null);
    setRevealed(false);
    try {
      const q = await generatePracticeQuestion(cid, history);
      setCurrent(q);
    } catch (e: any) {
      toast.error(e.message || "Couldn't generate question");
    } finally {
      setGenerating(false);
    }
  };

  // Auto-load first question once course is loaded
  useEffect(() => {
    if (course && !current && !generating) fetchNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  const handleSelect = (i: number) => {
    if (revealed) return;
    setChosen(i);
  };

  const handleReveal = () => {
    if (chosen === null || !current) return;
    setRevealed(true);
    setHistory(prev => [...prev, {
      question: current.question,
      was_correct: chosen === current.correct_index,
    }]);
  };

  const handleNext = () => fetchNext();

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/40">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">

        {/* Header bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-sat-primary" />
                <p className="text-xs font-semibold text-sat-primary uppercase tracking-wide">
                  Adaptive Practice
                </p>
              </div>
              <h1 className="text-lg font-bold text-gray-900">{course?.title}</h1>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              End session
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <StatTile label="Correct" value={`${correct}/${total || 0}`} color="text-green-600" />
            <StatTile label="Accuracy" value={`${accuracy}%`} color="text-sat-primary" />
            <StatTile
              label={
                <span className="inline-flex items-center gap-1">
                  Streak {streak >= 3 && <Flame className="w-3.5 h-3.5 text-amber-500" />}
                </span>
              }
              value={streak.toString()}
              color={streak >= 3 ? "text-amber-600" : "text-gray-700"}
            />
          </div>
        </div>

        {/* Question card */}
        {generating || !current ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-12 h-12 mx-auto mb-4 relative">
              <div className="absolute inset-0 border-4 border-indigo-200 rounded-full" />
              <div className="absolute inset-0 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-gray-700 font-medium">AI is generating your next question…</p>
            <p className="text-xs text-gray-400 mt-2">
              Adjusting difficulty based on your last {Math.min(history.length, 3)} answer{history.length === 1 ? "" : "s"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Topic + difficulty pill */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/50">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Topic: <span className="text-gray-700">{current.topic}</span>
              </span>
              <DifficultyPill level={current.difficulty} />
            </div>

            {/* Question + options */}
            <div className="p-6">
              <p className="text-base font-medium text-gray-900 mb-5 leading-relaxed">
                {current.question}
              </p>
              <div className="space-y-2.5">
                {current.options.map((opt, i) => {
                  const isChosen = chosen === i;
                  const isCorrect = i === current.correct_index;
                  const showAsCorrect = revealed && isCorrect;
                  const showAsWrong = revealed && isChosen && !isCorrect;

                  let cls = "border-gray-200 hover:border-gray-300 bg-white text-gray-700";
                  if (showAsCorrect) cls = "border-green-300 bg-green-50 text-green-800";
                  else if (showAsWrong) cls = "border-red-300 bg-red-50 text-red-800";
                  else if (isChosen) cls = "border-sat-primary bg-indigo-50 text-sat-primary font-medium";

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(i)}
                      disabled={revealed}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${cls} ${revealed ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${
                        showAsCorrect ? "bg-green-600 text-white"
                        : showAsWrong ? "bg-red-500 text-white"
                        : isChosen ? "bg-sat-primary text-white"
                        : "bg-gray-100 text-gray-500"
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {showAsCorrect && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                      {showAsWrong && <XCircle className="w-5 h-5 text-red-500" />}
                    </button>
                  );
                })}
              </div>

              {/* Explanation block — appears after reveal */}
              {revealed && (
                <div className={`mt-5 rounded-xl p-4 border ${
                  chosen === current.correct_index
                    ? "bg-green-50 border-green-100"
                    : "bg-amber-50 border-amber-100"
                }`}>
                  <div className="flex items-start gap-3">
                    {chosen === current.correct_index ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-sm font-semibold mb-1 ${
                        chosen === current.correct_index ? "text-green-800" : "text-amber-800"
                      }`}>
                        {chosen === current.correct_index ? "Correct!" : "Not quite."}
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {current.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action button */}
              <div className="mt-6 flex justify-end">
                {!revealed ? (
                  <button
                    onClick={handleReveal}
                    disabled={chosen === null}
                    className="bg-sat-primary text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-sat-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Reveal answer
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={generating}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-50 transition-all"
                  >
                    Next question
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Achievement nudge */}
        {streak >= 5 && (
          <div className="mt-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-500" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{streak}-question streak!</span> The AI is making them harder for you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const StatTile = ({ label, value, color }: { label: React.ReactNode; value: string; color: string }) => (
  <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
    <p className={`text-xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-gray-400 mt-0.5">{label}</p>
  </div>
);

const DifficultyPill = ({ level }: { level: "easy" | "medium" | "hard" }) => {
  const cfg = {
    easy: { bg: "bg-green-100", text: "text-green-700", label: "Easy" },
    medium: { bg: "bg-blue-100", text: "text-sat-primary", label: "Medium" },
    hard: { bg: "bg-amber-100", text: "text-amber-700", label: "Hard" },
  }[level];
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
};

export default Practice;
