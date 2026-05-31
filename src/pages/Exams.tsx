// src/pages/Exams.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  getCurrentUser, getMyEnrollments, getCoursesImTeaching,
  getCourseAssignments, getStudentSubmissions,
  getTutorSubmissions, submitAssignment,
  gradeSubmission, createAssignment, updateAssignment, deleteAssignment,
  downloadSubmission, downloadAssignmentAttachment, isLoggedIn, removeToken,
} from "@/lib/api";
import type { User, Course, Enrollment, Assignment, Submission } from "@/lib/api";
import { toast } from "sonner";
import { Upload, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { parseBackendDate, formatDateTime } from "@/lib/datetime";
import { Pencil, Trash2, Save, X } from "lucide-react";

const Exams = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    getCurrentUser()
      .then(setUser)
      .catch(() => { removeToken(); navigate("/login"); })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800">
              {user.role === "student" ? "My Assignments" : "Course Assignments"}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {user.role === "student"
                ? "Submit work, track deadlines, and view your grades"
                : "Create assignments, review submissions, and add grades"}
            </p>
          </div>

          {user.role === "student" && <StudentExams user={user} />}
          {(user.role === "tutor" || user.role === "admin") && <TutorExams user={user} />}
        </div>
      </main>
      <Footer />
    </div>
  );
};

// ─── STUDENT VIEW ─────────────────────────────────────────────────────────────

const StudentExams = ({ user }: { user: User }) => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  useEffect(() => {
    Promise.all([getMyEnrollments(), getStudentSubmissions(user.id)])
      .then(([e, s]) => {
        setEnrollments(e);
        setSubmissions(s);
        if (e.length > 0) setSelectedCourseId(e[0].course_id);
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, [user.id]);

  useEffect(() => {
    if (!selectedCourseId) return;
    setLoadingAssignments(true);
    getCourseAssignments(selectedCourseId)
      .then(setAssignments)
      .catch(() => toast.error("Failed to load assignments"))
      .finally(() => setLoadingAssignments(false));
  }, [selectedCourseId]);

  const submissionMap = new Map(submissions.map(s => [s.assignment_id, s]));
  const selectedCourse = enrollments.find(e => e.course_id === selectedCourseId);

  const submitted = assignments.filter(a => submissionMap.has(a.id)).length;
  const graded = submissions.filter(s => s.grade !== null).length;
  const overdue = assignments.filter(a =>
    !submissionMap.has(a.id) && parseBackendDate(a.due_date)! < new Date()
  ).length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Course selector */}
      {enrollments.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No courses enrolled"
          desc="Enroll in a course to see assignments."
          action={{ label: "Browse courses", href: "/courses" }}
        />
      ) : (
        <>
          {/* Course tabs */}
          <div className="flex gap-2 flex-wrap">
            {enrollments.map(e => (
              <button
                key={e.course_id}
                onClick={() => setSelectedCourseId(e.course_id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCourseId === e.course_id
                    ? "bg-sat-primary text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-sat-primary hover:text-sat-primary"
                }`}
              >
                {e.course.title}
              </button>
            ))}
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4">
            <StatMini label="Total" value={assignments.length} color="blue" />
            <StatMini label="Submitted" value={submitted} color="green" />
            <StatMini label="Overdue" value={overdue} color="red" />
          </div>

          {/* Assignments list */}
          {loadingAssignments ? (
            <LoadingSpinner />
          ) : assignments.length === 0 ? (
            <EmptyState icon="📝" title="No assignments yet" desc="Your tutor hasn't posted any assignments for this course yet." />
          ) : (
            <div className="space-y-4">
              {assignments
                .sort((a, b) => parseBackendDate(a.due_date)!.getTime() - parseBackendDate(b.due_date)!.getTime())
                .map(assignment => (
                  <StudentAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    submission={submissionMap.get(assignment.id) || null}
                    onSubmit={(file) => {
                      submitAssignment(assignment.id, file)
                        .then(sub => {
                          setSubmissions(prev => [...prev.filter(s => s.assignment_id !== assignment.id), sub]);
                          toast.success("Assignment submitted successfully!");
                        })
                        .catch(e => toast.error(e.message || "Submission failed"));
                    }}
                    onDownload={(sub) => downloadSubmission(sub.id, sub.filename).catch(() => toast.error("Download failed"))}
                  />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const StudentAssignmentCard = ({
  assignment, submission, onSubmit, onDownload
}: {
  assignment: Assignment;
  submission: Submission | null;
  onSubmit: (file: File) => void;
  onDownload: (sub: Submission) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const now = new Date();
  const due = parseBackendDate(assignment.due_date)!;
  const isOverdue = due < now && !submission;
  const isSubmitted = !!submission;
  const isGraded = submission?.grade !== null && submission?.grade !== undefined;

  // Countdown
  const diff = due.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const countdownText = diff < 0
    ? "Overdue"
    : days > 0 ? `${days}d ${hours}h remaining`
    : hours > 0 ? `${hours}h remaining`
    : "Due soon";

  const statusColor = isGraded
    ? "border-l-purple-500"
    : isSubmitted ? "border-l-green-500"
    : isOverdue ? "border-l-red-400"
    : "border-l-blue-400";

  return (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${statusColor} shadow-sm`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-6 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <StatusBadge submission={submission} isOverdue={isOverdue} />
          <div>
            <p className="font-semibold text-gray-800">{assignment.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Due: {formatDateTime(assignment.due_date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Countdown */}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            isOverdue ? "bg-red-50 text-red-600"
            : diff < 86400000 ? "bg-amber-50 text-amber-600"
            : "bg-blue-50 text-blue-600"
          }`}>
            {countdownText}
          </span>

          {/* Grade badge */}
          {isGraded && (
            <span className="text-sm font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
              {submission!.grade}/100
            </span>
          )}

          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-50 pt-4 space-y-5">

          {/* Description */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{assignment.description}</p>
          </div>

          {/* Tutor attachment */}
          {assignment.attachment_filename && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Tutor attachment</p>
              <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
                <FileText className="w-4 h-4 text-sat-primary flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1">{assignment.attachment_filename}</span>
                <button
                  onClick={() => downloadAssignmentAttachment(assignment.id, assignment.attachment_filename!).catch(() => toast.error("Download failed"))}
                  className="text-xs text-sat-primary hover:underline font-medium whitespace-nowrap"
                >
                  Download
                </button>
              </div>
            </div>
          )}

          {/* Submission section */}
          {!isSubmitted ? (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Submit your work</p>
              {isOverdue ? (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 px-4 py-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  The deadline has passed. Submission is no longer available.
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sat-primary file:text-white hover:file:bg-sat-secondary"
                  />
                  <button
                    onClick={() => { if (selectedFile) { onSubmit(selectedFile); setSelectedFile(null); } }}
                    disabled={!selectedFile}
                    className="flex items-center gap-2 bg-sat-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-sat-secondary disabled:opacity-40 whitespace-nowrap"
                  >
                    <Upload className="w-4 h-4" />
                    Submit
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Submitted file */}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Your submission</p>
                <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">{submission!.filename}</p>
                      <p className="text-xs text-green-600">
                        Submitted {formatDateTime(submission!.upload_time)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDownload(submission!)}
                    className="text-xs text-green-700 hover:underline font-medium"
                  >
                    Download
                  </button>
                </div>
              </div>

              {/* Grade and feedback */}
              {isGraded ? (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Tutor feedback</p>
                  <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl font-bold text-purple-700">{submission!.grade}</span>
                      <span className="text-gray-400 text-lg">/100</span>
                      <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ml-2 ${
                        submission!.grade! >= 70 ? "bg-green-100 text-green-700"
                        : submission!.grade! >= 50 ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                      }`}>
                        {submission!.grade! >= 70 ? "Pass" : submission!.grade! >= 50 ? "Borderline" : "Fail"}
                      </span>
                    </div>
                    {submission!.feedback && (
                      <p className="text-sm text-gray-700 leading-relaxed border-t border-purple-100 pt-3">
                        {submission!.feedback}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 px-4 py-3 rounded-lg">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  Submitted — waiting for your tutor to grade this.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── TUTOR VIEW ───────────────────────────────────────────────────────────────

const TutorExams = ({ user }: { user: User }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Create assignment form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getCoursesImTeaching()
      .then(mine => {
        setCourses(mine);
        if (mine.length > 0) setSelectedCourseId(mine[0].id);
      })
      .catch(() => toast.error("Failed to load courses"))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selectedCourseId) return;
    setLoadingAssignments(true);
    getCourseAssignments(selectedCourseId)
      .then(setAssignments)
      .catch(() => toast.error("Failed to load assignments"))
      .finally(() => setLoadingAssignments(false));
  }, [selectedCourseId]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDue || !selectedCourseId) {
      toast.error("Please fill in all fields"); return;
    }
    setCreating(true);
    try {
      const a = await createAssignment(selectedCourseId, newTitle, newDesc, newDue, newFile);
      setAssignments(prev => [...prev, a]);
      setNewTitle(""); setNewDesc(""); setNewDue(""); setNewFile(null); setShowForm(false);
      toast.success("Assignment created!");
    } catch (e: any) {
      toast.error(e.message || "Failed to create assignment");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {courses.length === 0 ? (
        <EmptyState icon="📚" title="No courses yet" desc="Create a course first before adding assignments." />
      ) : (
        <>
          {/* Course tabs */}
          <div className="flex gap-2 flex-wrap">
            {courses.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCourseId(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCourseId === c.id
                    ? "bg-sat-primary text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-sat-primary hover:text-sat-primary"
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>

          {/* Create assignment */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-sat-primary hover:underline"
            >
              {showForm ? "− Cancel" : "+ New assignment"}
            </button>

            {showForm && (
              <div className="mt-4 space-y-3">
                <input
                  placeholder="Assignment title"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary"
                />
                <textarea
                  placeholder="Description — explain what students need to do"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary resize-none"
                />
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Due date</label>
                    <input
                      type="datetime-local"
                      value={newDue}
                      onChange={e => setNewDue(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Attachment (optional — students will be able to download this)</label>
                  <input
                    type="file"
                    onChange={e => setNewFile(e.target.files?.[0] || null)}
                    className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-sat-primary hover:file:bg-sat-accent"
                  />
                  {newFile && <p className="text-xs text-gray-400 mt-1">{newFile.name}</p>}
                </div>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="bg-sat-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-sat-secondary disabled:opacity-50 w-full sm:w-auto"
                >
                  {creating ? "Creating..." : "Create assignment"}
                </button>
              </div>
            )}
          </div>

          {/* Assignments with submissions */}
          {loadingAssignments ? (
            <LoadingSpinner />
          ) : assignments.length === 0 ? (
            <EmptyState icon="📝" title="No assignments yet" desc="Create the first assignment for this course above." />
          ) : (
            <div className="space-y-4">
              {assignments
                .sort((a, b) => parseBackendDate(a.due_date)!.getTime() - parseBackendDate(b.due_date)!.getTime())
                .map(assignment => (
                  <TutorAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onUpdated={(a) => setAssignments(prev => prev.map(x => x.id === a.id ? a : x))}
                    onDeleted={(id) => setAssignments(prev => prev.filter(x => x.id !== id))}
                  />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const TutorAssignmentCard = ({
  assignment, onUpdated, onDeleted,
}: {
  assignment: Assignment;
  onUpdated: (a: Assignment) => void;
  onDeleted: (id: number) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [gradeInputs, setGradeInputs] = useState<Record<number, { grade: string; feedback: string }>>({});

  // Edit form state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(assignment.title);
  const [editDesc, setEditDesc] = useState(assignment.description);
  // Convert backend ISO → datetime-local input value (YYYY-MM-DDTHH:mm)
  const initialDueLocal = (() => {
    const d = parseBackendDate(assignment.due_date);
    if (!d) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  const [editDue, setEditDue] = useState(initialDueLocal);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [saving, setSaving] = useState(false);

  const due = parseBackendDate(assignment.due_date)!;
  const isOverdue = due.getTime() < Date.now();

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      const fields: any = {};
      if (editTitle.trim() && editTitle !== assignment.title) fields.title = editTitle;
      if (editDesc !== assignment.description) fields.description = editDesc;
      if (editDue) {
        const dueIso = new Date(editDue).toISOString();
        fields.due_date = dueIso;
      }
      if (editFile) fields.attachment = editFile;
      if (removeFile) fields.remove_attachment = true;
      const updated = await updateAssignment(assignment.id, fields);
      onUpdated(updated);
      setEditing(false);
      setEditFile(null);
      setRemoveFile(false);
      toast.success("Assignment updated");
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${assignment.title}"? This also removes all submissions.`)) return;
    try {
      await deleteAssignment(assignment.id);
      onDeleted(assignment.id);
      toast.success("Assignment deleted");
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  const loadSubmissions = () => {
    if (submissions.length > 0) return;
    setLoadingSubs(true);
    getTutorSubmissions(assignment.id)
      .then(setSubmissions)
      .catch(() => toast.error("Failed to load submissions"))
      .finally(() => setLoadingSubs(false));
  };

  const handleExpand = () => {
    setExpanded(v => !v);
    if (!expanded) loadSubmissions();
  };

  const handleGrade = async (submissionId: number) => {
    const input = gradeInputs[submissionId];
    if (!input?.grade) { toast.error("Enter a grade first"); return; }
    const gradeNum = parseInt(input.grade);
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
      toast.error("Grade must be between 0 and 100"); return;
    }
    setGradingId(submissionId);
    try {
      const updated = await gradeSubmission(submissionId, gradeNum, input.feedback || "");
      setSubmissions(prev => prev.map(s => s.id === submissionId ? updated : s));
      toast.success("Grade saved!");
    } catch (e: any) {
      toast.error(e.message || "Grading failed");
    } finally {
      setGradingId(null);
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${isOverdue ? "border-l-red-400" : "border-l-blue-400"} shadow-sm`}>
      <div
        onClick={editing ? undefined : handleExpand}
        className={`w-full text-left px-6 py-4 flex items-center justify-between ${editing ? "" : "cursor-pointer"}`}
      >
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="w-full font-semibold text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary"
            />
          ) : (
            <>
              <p className="font-semibold text-gray-800">{assignment.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Due: {formatDateTime(assignment.due_date)}
                {isOverdue && <span className="ml-2 text-red-500 font-medium">· Deadline passed</span>}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          {!editing && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {submissions.length > 0 ? `${submissions.length} submission${submissions.length !== 1 ? "s" : ""}` : "View"}
            </span>
          )}
          {!editing ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); setExpanded(true); }}
                title="Edit"
                className="p-1.5 text-gray-400 hover:text-sat-primary hover:bg-indigo-50 rounded-lg"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                title="Delete"
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </>
          ) : (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1 bg-sat-primary text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-sat-secondary disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(false); setEditTitle(assignment.title); setEditDesc(assignment.description); setEditDue(initialDueLocal); setEditFile(null); setRemoveFile(false); }}
                className="inline-flex items-center gap-1 text-gray-500 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-50 pt-4">
          {editing ? (
            <div className="space-y-3 mb-5 pb-5 border-b border-gray-100">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Due date</label>
                <input
                  type="datetime-local"
                  value={editDue}
                  onChange={e => setEditDue(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Attachment {assignment.attachment_filename && <span className="text-gray-400">(current: {assignment.attachment_filename})</span>}
                </label>
                <input
                  type="file"
                  onChange={e => { setEditFile(e.target.files?.[0] || null); setRemoveFile(false); }}
                  className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-sat-primary"
                />
                {assignment.attachment_filename && !editFile && (
                  <label className="inline-flex items-center gap-1.5 text-xs text-red-500 mt-2 cursor-pointer">
                    <input type="checkbox" checked={removeFile} onChange={e => setRemoveFile(e.target.checked)} />
                    Remove current attachment
                  </label>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 mb-4">{assignment.description}</p>
          )}

          {loadingSubs ? (
            <LoadingSpinner />
          ) : submissions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No submissions yet.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Submissions — {submissions.filter(s => s.grade !== null).length}/{submissions.length} graded
              </p>
              {submissions.map(sub => {
                const inputs = gradeInputs[sub.id] || { grade: sub.grade?.toString() || "", feedback: sub.feedback || "" };
                const isAlreadyGraded = sub.grade !== null;
                return (
                  <div key={sub.id} className={`rounded-lg border p-4 ${isAlreadyGraded ? "border-green-100 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sub.student?.name ?? `Student #${sub.student_id}`}</p>
                        {sub.student?.email && (
                          <p className="text-xs text-gray-400">{sub.student.email}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          Submitted {formatDateTime(sub.upload_time)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAlreadyGraded && (
                          <span className="text-sm font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                            {sub.grade}/100
                          </span>
                        )}
                        <button
                          onClick={() => downloadSubmission(sub.id, sub.filename).catch(() => toast.error("Download failed"))}
                          className="flex items-center gap-1.5 text-xs text-sat-primary hover:underline font-medium"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {sub.filename}
                        </button>
                      </div>
                    </div>

                    {/* Grading form */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Grade /100"
                          value={inputs.grade}
                          onChange={e => setGradeInputs(prev => ({ ...prev, [sub.id]: { ...inputs, grade: e.target.value } }))}
                          className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary"
                        />
                        <input
                          placeholder="Feedback for student (optional)"
                          value={inputs.feedback}
                          onChange={e => setGradeInputs(prev => ({ ...prev, [sub.id]: { ...inputs, feedback: e.target.value } }))}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sat-primary"
                        />
                        <button
                          onClick={() => handleGrade(sub.id)}
                          disabled={gradingId === sub.id}
                          className="bg-sat-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-sat-secondary disabled:opacity-50 whitespace-nowrap"
                        >
                          {gradingId === sub.id ? "Saving..." : isAlreadyGraded ? "Update grade" : "Save grade"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Shared primitives ────────────────────────────────────────────────────────

const StatusBadge = ({ submission, isOverdue }: { submission: Submission | null; isOverdue: boolean }) => {
  if (!submission) {
    return isOverdue
      ? <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full whitespace-nowrap"><AlertCircle className="w-3.5 h-3.5" />Overdue</span>
      : <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full whitespace-nowrap"><Clock className="w-3.5 h-3.5" />Pending</span>;
  }
  if (submission.grade !== null) {
    return <span className="flex items-center gap-1.5 text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full whitespace-nowrap"><CheckCircle className="w-3.5 h-3.5" />Graded</span>;
  }
  return <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full whitespace-nowrap"><CheckCircle className="w-3.5 h-3.5" />Submitted</span>;
};

const StatMini = ({ label, value, color }: { label: string; value: number; color: string }) => {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    green: "bg-green-50 border-green-100 text-green-700",
    red: "bg-red-50 border-red-100 text-red-700",
  };
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  );
};

const EmptyState = ({ icon, title, desc, action }: {
  icon: string; title: string; desc: string;
  action?: { label: string; href: string };
}) => {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
      <p className="text-4xl mb-3">{icon}</p>
      <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-5">{desc}</p>
      {action && (
        <button
          onClick={() => navigate(action.href)}
          className="bg-sat-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-sat-secondary transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="flex justify-center py-12">
    <div className="w-8 h-8 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export default Exams;