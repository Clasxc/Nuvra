// src/pages/Quizzes.tsx — Take a quiz (one question at a time)
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getQuiz, submitQuizAttempt, getCurrentUser, isLoggedIn, explainQuizMistake } from "@/lib/api";
import type { Quiz, AttemptResult, User } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { CheckCircle, XCircle, ChevronRight, Sparkles } from "lucide-react";

type Phase = "taking" | "result";

const QuizPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const quizId = Number(id);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("taking");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    Promise.all([getQuiz(quizId), getCurrentUser()])
      .then(([q, u]) => {
        setQuiz(q);
        setUser(u);
        setAnswers(new Array(q.questions.length).fill(null));
      })
      .catch(() => { toast.error("Quiz not found"); navigate(-1); })
      .finally(() => setLoading(false));
  }, [quizId]);

  const handleSelectOption = (optionIndex: number) => {
    setAnswers(prev => {
      const next = [...prev];
      next[currentQ] = optionIndex;
      return next;
    });
  };

  const handleNext = () => {
    if (currentQ < (quiz?.questions.length ?? 0) - 1) {
      setCurrentQ(q => q + 1);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    if (answers.some(a => a === null)) {
      toast.error("Please answer all questions before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await submitQuizAttempt(quizId, answers as number[]);
      setResult(r);
      setPhase("result");
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!quiz) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">

        {phase === "taking" && (
          <TakingPhase
            quiz={quiz}
            currentQ={currentQ}
            answers={answers}
            onSelect={handleSelectOption}
            onNext={handleNext}
            onBack={() => setCurrentQ(q => q - 1)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}

        {phase === "result" && result && (
          <ResultPhase
            quiz={quiz}
            result={result}
            answers={answers as number[]}
            onRetake={() => {
              setAnswers(new Array(quiz.questions.length).fill(null));
              setCurrentQ(0);
              setPhase("taking");
            }}
            onBack={() => navigate(-1)}
          />
        )}
      </div>
    </div>
  );
};

// ─── Taking phase ─────────────────────────────────────────────────────────────

const TakingPhase = ({
  quiz, currentQ, answers, onSelect, onNext, onBack, onSubmit, submitting
}: {
  quiz: Quiz;
  currentQ: number;
  answers: (number | null)[];
  onSelect: (i: number) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) => {
  const q = quiz.questions[currentQ];
  const total = quiz.questions.length;
  const isLast = currentQ === total - 1;
  const chosen = answers[currentQ];
  const allAnswered = answers.every(a => a !== null);

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-500">{quiz.title}</p>
          <p className="text-sm text-gray-400">{currentQ + 1} / {total}</p>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-sat-primary h-1.5 rounded-full transition-all"
            style={{ width: `${((currentQ + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <p className="text-lg font-medium text-gray-900 mb-6">{q.question}</p>
        <div className="space-y-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                chosen === i
                  ? "border-sat-primary bg-blue-50 text-sat-primary font-medium"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 ${
                chosen === i ? "bg-sat-primary text-white" : "bg-gray-100 text-gray-500"
              }`}>
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={currentQ === 0}
          className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        {isLast ? (
          <button
            onClick={onSubmit}
            disabled={submitting || !allAnswered}
            className="px-6 py-2 bg-sat-primary text-white text-sm font-medium rounded-lg hover:bg-sat-secondary disabled:opacity-50 transition-colors"
          >
            {submitting ? "Submitting..." : "Submit quiz"}
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={chosen === null}
            className="flex items-center gap-1 px-4 py-2 bg-sat-primary text-white text-sm font-medium rounded-lg hover:bg-sat-secondary disabled:opacity-50 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Answer dots overview */}
      <div className="flex gap-1.5 mt-4 flex-wrap">
        {answers.map((a, i) => (
          <button
            key={i}
            onClick={() => {/* jump to question */}}
            className={`w-7 h-7 rounded-full text-xs font-medium transition-colors ${
              i === currentQ ? "ring-2 ring-sat-primary ring-offset-1" : ""
            } ${a !== null ? "bg-sat-primary text-white" : "bg-gray-200 text-gray-400"}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Result phase ─────────────────────────────────────────────────────────────

const ResultPhase = ({
  quiz, result, answers, onRetake, onBack
}: {
  quiz: Quiz;
  result: AttemptResult;
  answers: number[];
  onRetake: () => void;
  onBack: () => void;
}) => {
  const isPassing = result.score >= 60;
  const [aiExplanations, setAiExplanations] = useState<Record<number, string>>({});
  const [loadingAi, setLoadingAi] = useState<Record<number, boolean>>({});

  const askAi = async (questionIndex: number, chosenIndex: number) => {
    setLoadingAi(prev => ({ ...prev, [questionIndex]: true }));
    try {
      const r = await explainQuizMistake(quiz.id, questionIndex, chosenIndex);
      setAiExplanations(prev => ({ ...prev, [questionIndex]: r.explanation }));
    } catch (e: any) {
      toast.error(e.message || "Couldn't get AI explanation");
    } finally {
      setLoadingAi(prev => ({ ...prev, [questionIndex]: false }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Score card */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
          isPassing ? "bg-green-100" : "bg-red-100"
        }`}>
          <span className="text-3xl font-bold" style={{ color: isPassing ? "#16a34a" : "#dc2626" }}>
            {result.score}%
          </span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {isPassing ? "Well done! 🎉" : "Keep practicing!"}
        </h2>
        <p className="text-gray-500 text-sm">
          {result.correct} correct out of {result.total} questions
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={onRetake} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            Retake quiz
          </button>
          <button onClick={onBack} className="px-4 py-2 bg-sat-primary text-white rounded-lg text-sm hover:bg-sat-secondary">
            Back to course
          </button>
        </div>
      </div>

      {/* Per-question breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Question review</h3>
        <div className="space-y-5">
          {quiz.questions.map((q, i) => {
            const pq = result.per_question[i];
            return (
              <div key={i} className={`p-4 rounded-xl border ${pq.correct ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                <div className="flex items-start gap-3 mb-3">
                  {pq.correct
                    ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    : <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  }
                  <p className="font-medium text-gray-900 text-sm">{q.question}</p>
                </div>
                <div className="ml-8 space-y-1.5">
                  {q.options.map((opt, oi) => {
                    const isChosen = oi === pq.chosen;
                    const isCorrect = oi === pq.correct_index;
                    return (
                      <div key={oi} className={`text-sm px-3 py-1.5 rounded-lg ${
                        isCorrect ? "bg-green-200 text-green-800 font-medium"
                        : isChosen && !isCorrect ? "bg-red-200 text-red-800"
                        : "text-gray-600"
                      }`}>
                        <span className="font-mono text-xs mr-2">{String.fromCharCode(65 + oi)}.</span>
                        {opt}
                        {isCorrect && " ✓"}
                        {isChosen && !isCorrect && " ✗"}
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-500 mt-2 italic">{pq.explanation}</p>

                  {/* Personalized AI explanation — the signature feature */}
                  {!pq.correct && (
                    <div className="mt-3">
                      {aiExplanations[i] ? (
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-sat-primary" />
                            <p className="text-xs font-semibold text-sat-primary uppercase tracking-wide">
                              Personalized explanation
                            </p>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                            {aiExplanations[i]}
                          </p>
                        </div>
                      ) : loadingAi[i] ? (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex items-center gap-3">
                          <div className="w-4 h-4 border-2 border-sat-primary border-t-transparent rounded-full animate-spin" />
                          <p className="text-sm text-sat-primary font-medium">
                            AI tutor is analyzing your answer…
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => askAi(i, pq.chosen)}
                          className="inline-flex items-center gap-2 text-sm font-medium bg-white border border-indigo-200 text-sat-primary px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
                        >
                          <Sparkles className="w-4 h-4" />
                          Ask AI why I got this wrong
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuizPage;
