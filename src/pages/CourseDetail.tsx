// src/pages/CourseDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getCourseDetail, getCourse, getSessions, getCourseMaterials,
  enrollInCourse, unenrollFromCourse, isLoggedIn, getCurrentUser,
  getCourseQuizzes, downloadMaterial, generateStudyGuide,
} from "@/lib/api";
import type { CourseDetail, Course, Session, Material, User, QuizSummary, StudyGuide } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { BookOpen, Users, Calendar, FileText, CheckCircle, Clock, Sparkles, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { parseBackendDate, formatDateTime } from "@/lib/datetime";

type Tab = "overview" | "sessions" | "materials" | "quizzes" | "guide";

const CourseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const courseId = Number(id);

  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [studyGuide, setStudyGuide] = useState<StudyGuide | null>(null);
  const [generatingGuide, setGeneratingGuide] = useState(false);

  const load = async () => {
    try {
      const [det, c, s] = await Promise.all([
        getCourseDetail(courseId),
        getCourse(courseId),
        getSessions(courseId),
      ]);
      setDetail(det);
      setCourse(c);
      setSessions(s.sort((a, b) => parseBackendDate(a.start_time)!.getTime() - parseBackendDate(b.start_time)!.getTime()));

      if (isLoggedIn()) {
        const u = await getCurrentUser();
        setUser(u);
        if (det.is_enrolled || u.role === "tutor" || u.role === "admin") {
          const [m, q] = await Promise.all([
            getCourseMaterials(courseId),
            getCourseQuizzes(courseId),
          ]);
          setMaterials(m);
          setQuizzes(q);
        }
      }
    } catch (e: any) {
      toast.error("Failed to load course");
      navigate("/courses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [courseId]);

  const handleEnroll = async () => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    setEnrolling(true);
    try {
      await enrollInCourse(courseId);
      toast.success("Enrolled successfully!");
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setEnrolling(false); }
  };

  const handleUnenroll = async () => {
    if (!confirm("Unenroll from this course?")) return;
    setEnrolling(true);
    try {
      await unenrollFromCourse(courseId);
      toast.success("Unenrolled");
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setEnrolling(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!detail || !course) return null;

  const canSeeMaterials = detail.is_enrolled || user?.role === "tutor" || user?.role === "admin";
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "sessions", label: `Sessions (${sessions.length})` },
    ...(canSeeMaterials ? [
      { key: "materials" as Tab, label: `Materials (${materials.length})` },
      { key: "quizzes" as Tab, label: `Quizzes (${quizzes.length})` },
      { key: "guide" as Tab, label: "✨ Study Guide" },
    ] : []),
  ];

  const handleGenerateGuide = async () => {
    setGeneratingGuide(true);
    try {
      const g = await generateStudyGuide(courseId);
      setStudyGuide(g);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate study guide");
    } finally {
      setGeneratingGuide(false);
    }
  };

  const downloadGuide = () => {
    if (!studyGuide) return;
    const blob = new Blob([studyGuide.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${studyGuide.course_title.replace(/[^a-z0-9]+/gi, "_")}_study_guide.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const upcoming = sessions.filter(s => parseBackendDate(s.start_time)!.getTime() > Date.now());
  const past = sessions.filter(s => parseBackendDate(s.start_time)!.getTime() <= Date.now());

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-5xl">

        {/* Hero */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <p className="text-xs font-medium text-sat-primary uppercase tracking-wide mb-2">Course</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">{detail.title}</h1>
              <p className="text-gray-600 leading-relaxed mb-4">{detail.description}</p>
              <p className="text-sm text-gray-500">
                Taught by <span className="font-medium text-gray-800">{detail.tutor_name}</span>
              </p>
            </div>

            {/* Enrollment card */}
            <div className="lg:w-64 shrink-0">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <Stat icon={<Users className="w-4 h-4" />} label="Students" value={detail.enrollment_count} />
                  <Stat icon={<Calendar className="w-4 h-4" />} label="Sessions" value={detail.sessions_count} />
                  <Stat icon={<FileText className="w-4 h-4" />} label="Materials" value={detail.materials_count} />
                  <Stat icon={<BookOpen className="w-4 h-4" />} label="Upcoming" value={upcoming.length} />
                </div>

                {user?.role === "student" && (
                  detail.is_enrolled ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-green-600 font-medium mb-3">
                        <CheckCircle className="w-4 h-4" />
                        Enrolled
                      </div>
                      <button
                        onClick={() => navigate(`/practice/${courseId}`)}
                        className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-indigo-200 transition-all"
                      >
                        <Sparkles className="w-4 h-4" />
                        AI Practice Mode
                      </button>
                      <button
                        onClick={() => navigate("/dashboard")}
                        className="w-full bg-white border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                      >
                        Go to Dashboard
                      </button>
                      <button
                        onClick={handleUnenroll}
                        disabled={enrolling}
                        className="w-full text-sm text-red-400 hover:text-red-600 py-1.5 transition-colors"
                      >
                        Unenroll
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => navigate(`/enroll/${courseId}`)}
                      className="w-full bg-sat-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-sat-secondary transition-colors"
                    >
                      Enroll & pick schedule
                    </button>
                  )
                )}

                {!isLoggedIn() && (
                  <button
                    onClick={() => navigate("/login")}
                    className="w-full bg-sat-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-sat-secondary transition-colors"
                  >
                    Log in to enroll
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-3">About this course</h2>
            <p className="text-gray-600 leading-relaxed">{detail.description}</p>
            {!canSeeMaterials && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                Enroll to access course materials, quizzes, and study resources.
              </div>
            )}
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="space-y-4">
            {upcoming.length > 0 && (
              <Section title="Upcoming">
                {upcoming.map(s => <SessionCard key={s.id} session={s} />)}
              </Section>
            )}
            {past.length > 0 && (
              <Section title="Past sessions">
                {past.map(s => <SessionCard key={s.id} session={s} past />)}
              </Section>
            )}
            {sessions.length === 0 && (
              <EmptyState text="No sessions scheduled yet." />
            )}
          </div>
        )}

        {activeTab === "materials" && canSeeMaterials && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {materials.length === 0 ? (
              <EmptyState text="No materials uploaded yet." />
            ) : (
              <div className="space-y-2">
                {materials.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{m.filetype?.includes("pdf") ? "📄" : "📝"}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{m.filename}</p>
                        <p className="text-xs text-gray-400 uppercase">{m.filetype?.split("/").pop()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadMaterial(m.id, m.filename)}
                      className="text-xs text-sat-primary hover:underline font-medium"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "guide" && canSeeMaterials && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {!studyGuide ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-200">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">AI-Generated Study Guide</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                  Let NUVRA's AI read through this course's materials and create a personalized study guide — key concepts, common pitfalls, self-check questions, and pro tips.
                </p>
                <button
                  onClick={handleGenerateGuide}
                  disabled={generatingGuide}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-50 transition-all"
                >
                  {generatingGuide ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating your guide…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Study Guide
                    </>
                  )}
                </button>
                {generatingGuide && (
                  <p className="text-xs text-gray-400 mt-4">
                    The AI is reading through course materials… this usually takes 10–15 seconds.
                  </p>
                )}
              </div>
            ) : (
              <div>
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sat-primary" />
                    <p className="text-sm font-medium text-gray-700">AI-generated · personalized for this course</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={downloadGuide}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                    <button
                      onClick={handleGenerateGuide}
                      disabled={generatingGuide}
                      className="text-xs font-medium text-sat-primary bg-white border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                {/* Rendered markdown */}
                <article className="prose prose-sm sm:prose max-w-none px-8 py-8 prose-headings:text-gray-900 prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h2:text-lg prose-h2:font-semibold prose-h2:text-sat-primary prose-h2:mt-6 prose-h2:mb-3 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-li:my-1 prose-strong:text-gray-900 prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                  <ReactMarkdown>{studyGuide.content}</ReactMarkdown>
                </article>
              </div>
            )}
          </div>
        )}

        {activeTab === "quizzes" && canSeeMaterials && (
          <div className="space-y-3">
            {quizzes.length === 0 ? (
              <EmptyState text="No quizzes available yet. Your tutor will generate them from course materials." />
            ) : (
              quizzes.map(q => (
                <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{q.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{q.question_count} questions</p>
                    {q.my_best_score !== null && (
                      <p className="text-xs mt-1 text-green-600 font-medium">Best score: {q.my_best_score}%</p>
                    )}
                  </div>
                  {user?.role === "student" && (
                    <button
                      onClick={() => navigate(`/quizzes/${q.id}`)}
                      className="bg-sat-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sat-secondary transition-colors"
                    >
                      {q.my_best_score !== null ? "Retake" : "Take quiz"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="text-center">
    <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">{icon}</div>
    <p className="text-xl font-bold text-gray-800">{value}</p>
    <p className="text-xs text-gray-400">{label}</p>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
    <div className="space-y-3">{children}</div>
  </div>
);

const SessionCard = ({ session, past = false }: { session: Session; past?: boolean }) => (
  <div className={`p-4 rounded-lg border ${past ? "bg-gray-50 border-gray-100" : "bg-blue-50 border-blue-100"}`}>
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          {past ? <Clock className="w-4 h-4 text-gray-400" /> : <Calendar className="w-4 h-4 text-blue-500" />}
          <p className="text-sm font-medium text-gray-800">
            {formatDateTime(session.start_time)}
          </p>
        </div>
      </div>
      {!past && session.zoom_link && (
        <a
          href={session.zoom_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-sat-primary hover:underline shrink-0"
        >
          Join Meet →
        </a>
      )}
    </div>
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-12 text-gray-400 text-sm">{text}</div>
);

export default CourseDetailPage;
