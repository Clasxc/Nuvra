// src/pages/Dashboard.tsx — updated with attendance code system
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUser, getCourses, getSessions, getCoursesImTeaching,
  getMyEnrollments, createSession, deleteSession,
  createCourse, isLoggedIn, removeToken, uploadDocument,
  getMyAttendedSessions, generateQuiz, getMyFocus,
} from "@/lib/api";
import type { User, Course, Session, Enrollment, MyFocus } from "@/lib/api";
import Navbar from "@/components/Navbar";
import CourseMaterials from "@/components/CourseMaterials";
import { AttendanceCodeGenerator, AttendanceCodeEntry } from "@/components/AttendanceCode";
import { toast } from "sonner";
import { CheckCircle, Target, Sparkles } from "lucide-react";
import { DashboardSkeleton } from "@/components/Skeleton";
import { parseBackendDate, formatDateTime, formatTime } from "@/lib/datetime";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    getCurrentUser()
      .then(setUser)
      .catch(() => { removeToken(); navigate("/login"); })
      .finally(() => setIsLoading(false));
  }, [navigate]);

  if (isLoading) return <Spinner />;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Welcome, {user.name} 👋</h1>
            <p className="text-gray-400 text-sm mt-1 capitalize">{user.role} account</p>
          </div>
          <button
            onClick={() => { removeToken(); navigate("/"); }}
            className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-red-200 hover:text-red-500 transition-colors"
          >Log out</button>
        </div>

        {user.role === "student" && <StudentDashboard user={user} />}
        {user.role === "tutor"   && <TutorDashboard user={user} />}
        {user.role === "admin"   && <AdminDashboard user={user} />}
      </div>
    </div>
  );
};

// ─── STUDENT ─────────────────────────────────────────────────────────────────

const StudentDashboard = ({ user }: { user: User }) => {
  const navigate = useNavigate();
  const COURSE_KEY = `nuvra:student-selected-course:${user.id}`;
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendedIds, setAttendedIds] = useState<Set<number>>(new Set());
  const [selectedCourseId, setSelectedCourseIdRaw] = useState<number | null>(() => {
    const saved = localStorage.getItem(COURSE_KEY);
    return saved ? Number(saved) : null;
  });
  const [focus, setFocus] = useState<MyFocus | null>(null);
  const [loading, setLoading] = useState(true);

  // Wrap setter so every change is persisted
  const setSelectedCourseId = (id: number | null) => {
    setSelectedCourseIdRaw(id);
    if (id !== null) localStorage.setItem(COURSE_KEY, String(id));
    else localStorage.removeItem(COURSE_KEY);
  };

  const load = () => {
    Promise.all([
      getMyEnrollments(),
      getSessions(),
      getMyAttendedSessions(),
      getMyFocus().catch(() => null),
    ])
      .then(([e, s, a, f]) => {
        setEnrollments(e);
        setSessions(s);
        setAttendedIds(new Set(a));
        setFocus(f);
        // Restore selection if still valid, else fall back to first
        if (e.length > 0) {
          const saved = localStorage.getItem(COURSE_KEY);
          const savedId = saved ? Number(saved) : null;
          const stillValid = savedId !== null && e.some(en => en.course_id === savedId);
          setSelectedCourseId(stillValid ? savedId : e[0].course_id);
        }
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const enrolledIds = new Set(enrollments.map(e => e.course_id));

  // Sessions for enrolled courses — upcoming and recent (within 2 hours past)
  const relevantSessions = sessions
    .filter(s => enrolledIds.has(s.course_id))
    .filter(s => {
      const start = parseBackendDate(s.start_time)!;
      const twoHoursAfter = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      return twoHoursAfter.getTime() > Date.now(); // upcoming or ongoing
    })
    .sort((a, b) => parseBackendDate(a.start_time)!.getTime() - parseBackendDate(b.start_time)!.getTime());

  const isSessionActive = (s: Session) => {
    const start = parseBackendDate(s.start_time)!;
    const nowMs = Date.now();
    const fifteenBefore = start.getTime() - 15 * 60 * 1000;
    const twoHoursAfter = start.getTime() + 2 * 60 * 60 * 1000;
    return nowMs >= fifteenBefore && nowMs <= twoHoursAfter;
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Personalized focus card — the smart recommendation */}
      {focus && (
        <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 border border-indigo-200 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:shadow-indigo-100 hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-sat-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-sat-primary" />
                <p className="text-xs font-semibold text-sat-primary uppercase tracking-wide">
                  Personalized recommendation
                </p>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Focus on: <span className="text-sat-primary">{focus.topic}</span>
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Based on your recent quiz attempts in <span className="font-medium">{focus.course_title}</span>, this concept needs more practice.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate(`/quizzes/${focus.quiz_id}`)}
                  className="bg-sat-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-sat-secondary font-medium transition-colors"
                >
                  Retake quiz
                </button>
                <button
                  onClick={() => navigate("/ai-assistant")}
                  className="bg-white border border-indigo-200 text-sat-primary text-sm px-4 py-2 rounded-lg hover:bg-indigo-50 font-medium transition-colors"
                >
                  Ask AI Tutor about this
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Enrolled courses" value={enrollments.length} />
        <StatCard label="Sessions attended" value={attendedIds.size} />
        <StatCard label="AI assistant" value="Active" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Courses */}
        <Card title="My Courses" action={{ label: "Browse more", onClick: () => navigate("/courses") }}>
          {enrollments.length === 0 ? (
            <Empty text="You haven't enrolled in any courses yet.">
              <button onClick={() => navigate("/courses")}
                className="mt-3 bg-sat-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-sat-secondary transition-colors">
                Browse courses
              </button>
            </Empty>
          ) : (
            <div className="space-y-2">
              {enrollments.map(e => (
                <button key={e.id} onClick={() => setSelectedCourseId(e.course_id)}
                  className={`w-full text-left flex items-center justify-between p-3 rounded-lg transition-colors ${
                    selectedCourseId === e.course_id
                      ? "bg-blue-50 border border-sat-primary/30"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}>
                  <div>
                    <p className="font-medium text-sm text-gray-800">{e.course.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{e.course.description}</p>
                  </div>
                  {selectedCourseId === e.course_id && (
                    <span className="text-xs text-sat-primary font-medium ml-2">Selected</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Sessions */}
        <Card title="Sessions">
          {relevantSessions.length === 0 ? (
            <Empty text="No upcoming sessions for your courses." />
          ) : (
            <div className="space-y-3">
              {relevantSessions.map(s => {
                const attended = attendedIds.has(s.id);
                const active = isSessionActive(s);
                return (
                  <div key={s.id} className={`p-3 rounded-lg border ${
                    attended ? "bg-green-50 border-green-100"
                    : active ? "bg-blue-50 border-sat-primary/20"
                    : "bg-gray-50 border-gray-100"
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm text-gray-800">{s.course?.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDateTime(s.start_time)}
                        </p>
                      </div>
                      {attended && (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Present
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {s.zoom_link && (
                        <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-sat-primary hover:underline font-medium">
                          Join Meet →
                        </a>
                      )}

                      {/* Attendance code entry — only show during active window */}
                      {active && !attended && (
                        <AttendanceCodeEntry
                          sessionId={s.id}
                          sessionTitle={s.course?.title ?? ""}
                          onMarked={() => {
                            setAttendedIds(prev => new Set([...prev, s.id]));
                            toast.success("You're marked present!");
                          }}
                        />
                      )}

                      {active && !attended && (
                        <span className="text-xs text-blue-600 font-medium animate-pulse">
                          Session is live
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Course Materials */}
      {selectedCourseId && (
        <Card title="Course Materials">
          <CourseMaterials
            courseId={selectedCourseId}
            courseTitle={enrollments.find(e => e.course_id === selectedCourseId)?.course.title ?? ""}
            canDelete={false}
          />
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <ActionButton label="Ask AI Assistant" sub="Ask questions about your course" color="purple" onClick={() => navigate("/ai-assistant")} />
        <ActionButton label="My Progress" sub="Track sessions and assignments" color="green" onClick={() => navigate("/progress")} />
        <ActionButton label="My Exams" sub="Assignments and grades" color="blue" onClick={() => navigate("/exams")} />
      </div>
    </div>
  );
};

// ─── TUTOR ───────────────────────────────────────────────────────────────────

const TutorDashboard = ({ user }: { user: User }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionCourseId, setSessionCourseId] = useState<number | null>(null);
  const [sessionTime, setSessionTime] = useState("");
  const [sessionLink, setSessionLink] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [uploadCourseId, setUploadCourseId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [materialsKey, setMaterialsKey] = useState(0);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  const loadData = () => {
    Promise.all([getCoursesImTeaching(), getSessions()])
      .then(([mine, s]) => {
        setCourses(mine);
        setSessions(s.filter(sess => mine.some(mc => mc.id === sess.course_id)));
        if (mine.length > 0 && !selectedCourseId) {
          setSelectedCourseId(mine[0].id);
          setSessionCourseId(mine[0].id);
          setUploadCourseId(mine[0].id);
        }
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateCourse = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await createCourse(newTitle, newDesc, user.id);
      toast.success("Course created!");
      setNewTitle(""); setNewDesc(""); setShowCourseForm(false);
      loadData();
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const handleCreateSession = async () => {
    if (!sessionCourseId || !sessionTime || !sessionLink) {
      toast.error("Please fill in all session fields"); return;
    }
    setCreatingSession(true);
    try {
      await createSession(sessionCourseId, sessionTime, sessionLink);
      toast.success("Session created! Students have been notified.");
      setSessionTime(""); setSessionLink(""); setShowSessionForm(false);
      loadData();
    } catch (e: any) { toast.error(e.message); }
    finally { setCreatingSession(false); }
  };

  const handleDeleteSession = async (id: number) => {
    if (!confirm("Delete this session?")) return;
    try {
      await deleteSession(id);
      toast.success("Session deleted");
      loadData();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadCourseId) return;
    setUploading(true);
    try {
      await uploadDocument(uploadFile, uploadCourseId);
      toast.success("File uploaded and indexed for AI!");
      setUploadFile(null);
      setMaterialsKey(k => k + 1);
    } catch (e: any) { toast.error(e.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedCourseId) return;
    setGeneratingQuiz(true);
    try {
      await generateQuiz(selectedCourseId);
      toast.success("Quiz generated from course materials!");
    } catch (e: any) { toast.error(e.message || "Quiz generation failed"); }
    finally { setGeneratingQuiz(false); }
  };

  const isSessionActive = (s: Session) => {
    const start = parseBackendDate(s.start_time)!;
    const nowMs = Date.now();
    const thirtyBefore = start.getTime() - 30 * 60 * 1000;
    const twoHoursAfter = start.getTime() + 2 * 60 * 60 * 1000;
    return nowMs >= thirtyBefore && nowMs <= twoHoursAfter;
  };

  const upcoming = sessions
    .filter(s => parseBackendDate(s.start_time)!.getTime() > Date.now())
    .sort((a, b) => parseBackendDate(a.start_time)!.getTime() - parseBackendDate(b.start_time)!.getTime());

  const active = sessions.filter(isSessionActive);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Your courses" value={courses.length} />
        <StatCard label="Upcoming sessions" value={upcoming.length} />
        <StatCard label="Active now" value={active.length} />
      </div>

      {/* Active sessions — show attendance code generator prominently */}
      {active.length > 0 && (
        <Card title="Active sessions — generate attendance codes">
          <div className="space-y-4">
            {active.map(s => (
              <AttendanceCodeGenerator
                key={s.id}
                sessionId={s.id}
                sessionTitle={`${s.course?.title} — ${formatTime(s.start_time)}`}
              />
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Courses */}
        <Card title="My Courses" action={{ label: "+ New course", onClick: () => setShowCourseForm(v => !v) }}>
          {showCourseForm && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3">
              <input placeholder="Course title" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary" />
              <textarea placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary resize-none" />
              <div className="flex gap-2">
                <button onClick={handleCreateCourse} disabled={creating}
                  className="bg-sat-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-sat-secondary disabled:opacity-50">
                  {creating ? "Creating..." : "Create"}
                </button>
                <button onClick={() => setShowCourseForm(false)}
                  className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
          {courses.length === 0 ? <Empty text="No courses yet." /> : (
            <div className="space-y-2">
              {courses.map(c => (
                <button key={c.id} onClick={() => { setSelectedCourseId(c.id); setUploadCourseId(c.id); }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedCourseId === c.id ? "bg-blue-50 border border-sat-primary/30" : "bg-gray-50 hover:bg-gray-100"
                  }`}>
                  <p className="font-medium text-sm text-gray-800">{c.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.sessions.length} sessions</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Sessions */}
        <Card title="Sessions" action={{ label: "+ New session", onClick: () => setShowSessionForm(v => !v) }}>
          {showSessionForm && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3">
              <select value={sessionCourseId ?? ""} onChange={e => setSessionCourseId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary">
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input type="datetime-local" value={sessionTime} onChange={e => setSessionTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary" />
              <input placeholder="Google Meet link" value={sessionLink} onChange={e => setSessionLink(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary" />
              <div className="flex gap-2">
                <button onClick={handleCreateSession} disabled={creatingSession}
                  className="bg-sat-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-sat-secondary disabled:opacity-50">
                  {creatingSession ? "Creating..." : "Create session"}
                </button>
                <button onClick={() => setShowSessionForm(false)}
                  className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
          {upcoming.length === 0 ? <Empty text="No upcoming sessions." /> : (
            <div className="space-y-2">
              {upcoming.map(s => (
                <div key={s.id} className="p-3 bg-gray-50 rounded-lg flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{s.course?.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatDateTime(s.start_time)}</p>
                    {s.zoom_link && (
                      <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-sat-primary hover:underline mt-1 inline-block">Meet link →</a>
                    )}
                  </div>
                  <button onClick={() => handleDeleteSession(s.id)}
                    className="text-xs text-red-400 hover:text-red-600 ml-4">Delete</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Materials */}
      {courses.length > 0 && (
        <Card title="Course Materials">
          <div className="flex flex-col sm:flex-row gap-3 items-start mb-5 pb-5 border-b border-gray-100">
            <select value={uploadCourseId ?? ""} onChange={e => setUploadCourseId(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary">
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <input type="file" accept=".pdf,.txt" onChange={e => setUploadFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sat-primary file:text-white hover:file:bg-sat-secondary" />
            <button onClick={handleUpload} disabled={!uploadFile || uploading}
              className="bg-sat-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-sat-secondary disabled:opacity-50 whitespace-nowrap">
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <button onClick={handleGenerateQuiz} disabled={!selectedCourseId || generatingQuiz}
              className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap">
              {generatingQuiz ? "Generating..." : "✨ AI Quiz"}
            </button>
          </div>
          {selectedCourseId && (
            <CourseMaterials
              key={`${selectedCourseId}-${materialsKey}`}
              courseId={selectedCourseId}
              courseTitle={courses.find(c => c.id === selectedCourseId)?.title ?? ""}
              canDelete={true}
            />
          )}
        </Card>
      )}
    </div>
  );
};

// ─── ADMIN ───────────────────────────────────────────────────────────────────

const AdminDashboard = ({ user }: { user: User }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🛡️</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Admin Control Panel</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
          Manage users, courses, enrollments, and view platform analytics.
        </p>
        <button
          onClick={() => navigate("/admin")}
          className="bg-sat-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-sat-secondary transition-colors"
        >
          Open Admin Panel →
        </button>
      </div>
    </div>
  );
};

// ─── Shared primitives ────────────────────────────────────────────────────────

const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="w-8 h-8 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const StatCard = ({ label, value }: { label: string; value: number | string }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className="text-2xl font-semibold text-gray-800 capitalize">{value}</p>
  </div>
);

const Card = ({ title, children, action }: {
  title: string; children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      {action && (
        <button onClick={action.onClick} className="text-sm text-sat-primary hover:underline font-medium">
          {action.label}
        </button>
      )}
    </div>
    {children}
  </div>
);

const Empty = ({ text, children }: { text: string; children?: React.ReactNode }) => (
  <div className="text-center py-8">
    <p className="text-gray-400 text-sm">{text}</p>
    {children}
  </div>
);

const ActionButton = ({ label, sub, color, onClick }: {
  label: string; sub: string; color: string; onClick: () => void;
}) => {
  const colors: Record<string, string> = {
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
  };
  return (
    <button onClick={onClick}
      className={`p-4 rounded-xl border text-left transition-colors hover:shadow-sm ${colors[color]}`}>
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs mt-1 opacity-70">{sub}</p>
    </button>
  );
};

export default Dashboard;