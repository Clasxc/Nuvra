// src/components/AIChat.tsx
import { useState, useEffect, useRef } from "react";
import { Bot, Send, FileText, BookOpen, Trash2 } from "lucide-react";
import { getMyEnrollments, askAssistant, isLoggedIn, getCurrentUser, getAIHistory, clearAIHistory } from "@/lib/api";
import type { Enrollment, User } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  noMaterials?: boolean;
}

export const AIChat = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) { setLoadingEnrollments(false); return; }

    Promise.all([getCurrentUser(), getMyEnrollments()])
      .then(([u, enrolls]) => {
        setUser(u);
        // Tutors and admins see all courses via getCourses — but for AI
        // we scope students to only their enrolled courses
        if (u.role === "student") {
          setEnrollments(enrolls);
          if (enrolls.length > 0) setSelectedCourseId(enrolls[0].course_id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEnrollments(false));
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load conversation history when course changes
  useEffect(() => {
    if (!selectedCourseId) { setMessages([]); return; }
    getAIHistory(selectedCourseId, 50)
      .then(hist => {
        const mapped: Message[] = hist.map(h => ({
          role: h.role,
          content: h.content,
          sources: h.sources ?? undefined,
        }));
        setMessages(mapped);
      })
      .catch(() => setMessages([]));
  }, [selectedCourseId]);

  const handleClearHistory = async () => {
    if (!selectedCourseId) return;
    if (!confirm("Clear conversation history for this course?")) return;
    try {
      await clearAIHistory(selectedCourseId);
      setMessages([]);
      toast.success("History cleared");
    } catch { toast.error("Failed to clear"); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !selectedCourseId) return;

    const question = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setIsLoading(true);

    try {
      const response = await askAssistant(question, selectedCourseId);

      // If backend returned the "no materials" message, flag it specially
      const noMaterials = response.retrieved_documents.length === 0;
      const sources = response.retrieved_documents
        .map(d => d.source_filename)
        .filter((v, i, a) => a.indexOf(v) === i);

      setMessages(prev => [...prev, {
        role: "assistant",
        content: noMaterials
          ? "Your tutor hasn't uploaded any study materials for this course yet. Once they do, I'll be able to answer your questions based on exactly what they taught you. In the meantime, try asking your tutor to upload their notes or slides."
          : response.generated_response,
        sources: noMaterials ? [] : sources,
        noMaterials,
      }]);
    } catch (err: any) {
      toast.error(err.message || "Failed to get a response.");
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Something went wrong. Please try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCourse = enrollments.find(e => e.course_id === selectedCourseId)?.course;

  // ── Not logged in ──
  if (!isLoggedIn()) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-sat-primary px-6 py-4 flex items-center gap-3">
          <Bot className="text-white w-6 h-6" />
          <span className="text-white font-semibold text-lg">AI Study Assistant</span>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Log in to use the AI assistant</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-sm">
            The AI answers questions based on your course materials — enroll in a course first, then ask away.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/login")}
              className="bg-sat-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-sat-secondary transition-colors"
            >
              Log in
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="border border-gray-200 text-gray-600 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Sign up free
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loadingEnrollments) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-lg flex items-center justify-center" style={{ height: 400 }}>
        <div className="w-8 h-8 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Student with no enrollments ──
  if (user?.role === "student" && enrollments.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-sat-primary px-6 py-4 flex items-center gap-3">
          <Bot className="text-white w-6 h-6" />
          <span className="text-white font-semibold text-lg">AI Study Assistant</span>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No courses enrolled yet</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-sm">
            Enroll in a course first. The AI will then answer your questions based on that course's materials.
          </p>
          <button
            onClick={() => navigate("/courses")}
            className="bg-sat-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-sat-secondary transition-colors"
          >
            Browse courses
          </button>
        </div>
      </div>
    );
  }

  // ── Main chat UI ──
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden" style={{ height: 600 }}>

      {/* Header with course selector */}
      <div className="bg-sat-primary px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Bot className="text-white w-6 h-6" />
          <span className="text-white font-semibold">AI Study Assistant</span>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === "student" && enrollments.length > 0 && (
            <select
              value={selectedCourseId ?? ""}
              onChange={e => setSelectedCourseId(Number(e.target.value))}
              className="text-sm bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1.5 focus:outline-none max-w-[200px]"
            >
              {enrollments.map(e => (
                <option key={e.course_id} value={e.course_id} className="text-gray-800">
                  {e.course.title}
                </option>
              ))}
            </select>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              title="Clear conversation history (auto-deleted after 7 days)"
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Course context banner */}
      {selectedCourse && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-2 flex-shrink-0">
          <p className="text-xs text-blue-600">
            Asking about <span className="font-medium">{selectedCourse.title}</span> — answers are based only on your tutor's uploaded materials
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <Bot className="w-10 h-10 mb-3 opacity-20" />
            <p className="font-medium text-sm">Ask anything about your course</p>
            <p className="text-xs mt-1 max-w-xs">
              I'll answer based on what your tutor has taught — not from the internet
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "bg-sat-primary text-white rounded-br-sm"
                : msg.noMaterials
                  ? "bg-amber-50 text-amber-800 border border-amber-200 rounded-bl-sm"
                  : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
            }`}>
              {msg.noMaterials && (
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-amber-600">No materials uploaded yet</span>
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Sources used:</p>
                  {msg.sources.map((src, j) => (
                    <div key={j} className="flex items-center gap-1 text-xs text-gray-500">
                      <FileText className="w-3 h-3" />
                      {src}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1.5 items-center h-5">
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="w-2 h-2 bg-sat-primary rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-4 bg-white border-t border-gray-100 flex gap-3 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={
            enrollments.length === 0
              ? "Enroll in a course to start asking questions"
              : `Ask about ${selectedCourse?.title ?? "your course"}...`
          }
          disabled={isLoading || enrollments.length === 0}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading || enrollments.length === 0}
          className="bg-sat-primary text-white p-2.5 rounded-xl hover:bg-sat-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};