// src/lib/api.ts
// This is the "bridge" between your React frontend and your FastAPI backend.
// Every network call goes through here. Never call fetch() directly in a page component.

// Auto-detect the backend URL.
// - If VITE_API_URL is set in .env, use it (best for prod or LAN testing).
// - Otherwise, use the same hostname the frontend was served from, with port 8000.
//   This means if a teammate opens http://192.168.1.50:8080, the frontend
//   automatically talks to http://192.168.1.50:8000 — no hardcoded host.
const BASE_URL = (() => {
  const env = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (env) return env;
  if (typeof window !== "undefined") {
    const proto = window.location.protocol;
    const host = window.location.hostname;
    return `${proto}//${host}:8000`;
  }
  return "http://localhost:8000";
})();

// --- Token helpers ---
// The JWT token is stored in localStorage after login.
// Think of it like a "ticket" that proves who you are to the backend.

export const getToken = (): string | null => {
  return localStorage.getItem("token");
};

export const setToken = (token: string): void => {
  localStorage.setItem("token", token);
};

export const removeToken = (): void => {
  localStorage.removeItem("token");
};

export const isLoggedIn = (): boolean => {
  return getToken() !== null;
};

// --- Base fetch helper ---
// This adds the auth token to every request automatically.
// You don't have to remember to add it yourself each time.

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Only set Content-Type to JSON if we're not uploading a file
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Attach the token if we have one
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // If the server says "not authorized" AND we have a stale token, clear it.
  // Only redirect from authenticated pages, never from marketing / public ones.
  if (response.status === 401) {
    if (token) {
      removeToken();
      const path = window.location.pathname;
      const publicPaths = ["/", "/courses", "/login", "/signup", "/ai-assistant"];
      const isPublic = publicPaths.includes(path) || path.startsWith("/courses/");
      if (!isPublic) {
        window.location.href = "/login";
      }
    }
    throw new Error("Not authorized");
  }

  // For non-JSON responses (like deletes that return nothing)
  if (response.status === 204) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    // The backend sends errors in a { detail: "..." } format
    throw new Error(data.detail || "Something went wrong");
  }

  return data;
}

// =============================================================================
// AUTH
// =============================================================================

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: "student" | "tutor" | "admin";
}

// Login: sends email + password, gets back a token
// Note: FastAPI's login expects form data (username/password), not JSON
export async function login(email: string, password: string): Promise<LoginResponse> {
  const formData = new URLSearchParams();
  formData.append("username", email); // FastAPI OAuth2 uses "username" even if it's an email
  formData.append("password", password);

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Login failed");

  return data;
}

// Register a new user
export async function register(name: string, email: string, password: string, role = "student") {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, role }),
  });
}

// Get the currently logged-in user's info
export async function getCurrentUser(): Promise<User> {
  return apiFetch("/auth/users/me/");
}

// =============================================================================
// COURSES
// =============================================================================

export interface Course {
  id: number;
  title: string;
  description: string;
  tutor_id: number;
  sessions: Session[];
}

export async function getCourses(): Promise<Course[]> {
  return apiFetch("/courses/");
}

export async function getCourse(id: number): Promise<Course> {
  return apiFetch(`/courses/${id}`);
}

export async function createCourse(title: string, description: string, tutor_id: number) {
  return apiFetch("/courses/", {
    method: "POST",
    body: JSON.stringify({ title, description, tutor_id }),
  });
}
 
export async function deleteCourse(course_id: number) {
  return apiFetch(`/courses/${course_id}`, { method: "DELETE" });
}

export async function getCoursesImTeaching(): Promise<Course[]> {
  return apiFetch("/courses/instructing-me");
}

export interface CourseInstructor {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  role: "primary" | "co_teacher";
}

export async function getCourseInstructors(course_id: number): Promise<CourseInstructor[]> {
  return apiFetch(`/courses/${course_id}/instructors`);
}

export async function addCourseInstructor(course_id: number, user_id: number, role: "co_teacher" | "primary" = "co_teacher") {
  return apiFetch(`/courses/${course_id}/instructors`, {
    method: "POST",
    body: JSON.stringify({ user_id, role }),
  });
}

export async function removeCourseInstructor(course_id: number, user_id: number) {
  return apiFetch(`/courses/${course_id}/instructors/${user_id}`, { method: "DELETE" });
}

// =============================================================================
// SESSIONS
// =============================================================================

export interface Session {
  id: number;
  course_id: number;
  start_time: string;
  zoom_link: string;
  course?: Course;
}

export async function getSessions(course_id?: number): Promise<Session[]> {
  const query = course_id ? `?course_id=${course_id}` : "";
  return apiFetch(`/sessions/${query}`);
}

export async function createSession(course_id: number, start_time: string, zoom_link: string) {
  return apiFetch("/sessions/", {
    method: "POST",
    body: JSON.stringify({ course_id, start_time, zoom_link }),
  });
}
 
export async function deleteSession(session_id: number) {
  return apiFetch(`/sessions/${session_id}`, { method: "DELETE" });
}
// =============================================================================
// MATERIALS (file upload)
// =============================================================================

export interface Material {
  id: number;
  course_id: number;
  filename: string;
  filetype: string;
  path: string;
}

// Upload a study material file for a course
// This is what DocumentUpload.tsx was trying to import
export async function uploadDocument(file: File, course_id: number): Promise<Material> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("course_id", course_id.toString());

  return apiFetch("/materials/upload/", {
    method: "POST",
    body: formData,
    // Note: no Content-Type header — the browser sets it automatically for FormData
  });
}

export async function getCourseMaterials(course_id: number): Promise<Material[]> {
  return apiFetch(`/materials/course/${course_id}`);
}

// =============================================================================
// ASSIGNMENTS
// =============================================================================

export interface Assignment {
  id: number;
  course_id: number;
  title: string;
  description: string;
  due_date: string;
  attachment_filename: string | null;
}

export async function getAssignments(course_id?: number): Promise<Assignment[]> {
  const query = course_id ? `?course_id=${course_id}` : "";
  return apiFetch(`/assignments/${query}`);
}

export async function submitAssignment(assignment_id: number, file: File): Promise<Submission> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch(`/assignments/${assignment_id}/submit`, {
    method: "POST",
    body: formData,
  });
}

// =============================================================================
// AI ASSISTANT
// =============================================================================

export interface AIQueryResponse {
  generated_response: string;
  retrieved_documents: {
    source_filename: string;
    chunk_text: string;
    similarity_score: number;
  }[];
}

// Ask the AI assistant a question about a course
// This replaces the direct Gemini API call in AIChat.tsx
export async function askAssistant(query_text: string, course_id: number): Promise<AIQueryResponse> {
  return apiFetch("/assistant/query/", {
    method: "POST",
    body: JSON.stringify({ query_text, course_id }),
  });
}

export interface AIHistoryMessage {
  id: number;
  course_id: number;
  role: "user" | "assistant";
  content: string;
  sources: string[] | null;
  created_at: string;
}

export async function getAIHistory(course_id: number, limit = 50): Promise<AIHistoryMessage[]> {
  return apiFetch(`/assistant/history?course_id=${course_id}&limit=${limit}`);
}

export async function clearAIHistory(course_id: number) {
  return apiFetch(`/assistant/history?course_id=${course_id}`, { method: "DELETE" });
}

// =============================================================================
// ENROLLMENTS
// =============================================================================
 
export interface Enrollment {
  id: number;
  student_id: number;
  course_id: number;
  enrolled_at: string;
  course: Course;
}
 
// Student enrolls in a course
export async function enrollInCourse(course_id: number) {
  return apiFetch(`/enrollments/${course_id}`, { method: "POST" });
}
 
// Get all courses the current student is enrolled in
export async function getMyEnrollments(): Promise<Enrollment[]> {
  return apiFetch("/enrollments/my-courses");
}
 
// Unenroll from a course
export async function unenrollFromCourse(course_id: number) {
  return apiFetch(`/enrollments/${course_id}`, { method: "DELETE" });
}
 
// Get all students in a course (tutor/admin)
export async function getCourseStudents(course_id: number) {
  return apiFetch(`/enrollments/course/${course_id}/students`);
}

// ADD THIS to the bottom of src/lib/api.ts

export async function deleteMaterial(material_id: number) {
  return apiFetch(`/materials/${material_id}`, { method: "DELETE" });
}

export function getMaterialDownloadUrl(material_id: number): string {
  const token = getToken();
  // We return the URL — the browser handles the download directly
  return `${BASE_URL}/materials/${material_id}/download?token=${token}`;
}

// Because the download needs auth, we fetch it as a blob and trigger download
export async function downloadMaterial(material_id: number, filename: string) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/materials/${material_id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Download failed");

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
export interface Submission {
  id: number;
  student_id: number;
  assignment_id: number;
  filename: string;
  filetype: string;
  path: string;
  upload_time: string;
  grade: number | null;
  feedback: string | null;
  student?: { id: number; name: string; email: string; role: string };
}
 
export async function getCourseAssignments(course_id: number): Promise<Assignment[]> {
  return apiFetch(`/assignments/?course_id=${course_id}`);
}
 
export async function getStudentSubmissions(student_id: number): Promise<Submission[]> {
  return apiFetch(`/assignments/submissions/student/${student_id}`);
}

 
export async function getTutorSubmissions(assignment_id: number): Promise<Submission[]> {
  return apiFetch(`/assignments/${assignment_id}/submissions`);
}
 
export async function gradeSubmission(
  submission_id: number,
  grade: number,
  feedback: string
): Promise<Submission> {
  return apiFetch(`/assignments/submissions/${submission_id}/grade`, {
    method: "PUT",
    body: JSON.stringify({ grade, feedback }),
  });
}
 
export async function createAssignment(
  course_id: number,
  title: string,
  description: string,
  due_date: string,
  attachment?: File | null
): Promise<Assignment> {
  const formData = new FormData();
  formData.append("course_id", course_id.toString());
  formData.append("title", title);
  formData.append("description", description);
  formData.append("due_date", due_date);
  if (attachment) formData.append("attachment", attachment);
  return apiFetch("/assignments/", { method: "POST", body: formData });
}

export interface UpdateAssignmentFields {
  title?: string;
  description?: string;
  due_date?: string;
  attachment?: File | null;
  remove_attachment?: boolean;
}

export async function updateAssignment(
  assignment_id: number,
  fields: UpdateAssignmentFields
): Promise<Assignment> {
  const formData = new FormData();
  if (fields.title !== undefined) formData.append("title", fields.title);
  if (fields.description !== undefined) formData.append("description", fields.description);
  if (fields.due_date !== undefined) formData.append("due_date", fields.due_date);
  if (fields.attachment) formData.append("attachment", fields.attachment);
  if (fields.remove_attachment) formData.append("remove_attachment", "true");
  return apiFetch(`/assignments/${assignment_id}`, { method: "PUT", body: formData });
}

export async function deleteAssignment(assignment_id: number) {
  return apiFetch(`/assignments/${assignment_id}`, { method: "DELETE" });
}

export async function downloadAssignmentAttachment(assignment_id: number, filename: string) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/assignments/${assignment_id}/attachment/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
 
export async function downloadSubmission(submission_id: number, filename: string) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/assignments/submissions/${submission_id}/file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ADD THESE TO THE BOTTOM OF src/lib/api.ts

// =============================================================================
// ATTENDANCE
// =============================================================================

export interface AttendanceCode {
  session_id: number;
  code: string;
  expires_at: string;
}

// Tutor generates a code for a session
export async function generateAttendanceCode(session_id: number): Promise<AttendanceCode> {
  return apiFetch(`/attendance/generate-code/${session_id}`, { method: "POST" });
}

// Tutor re-fetches the active code (if still valid)
export async function getActiveCode(session_id: number): Promise<AttendanceCode> {
  return apiFetch(`/attendance/active-code/${session_id}`);
}

// Student submits a code to mark attendance
export async function markAttendanceWithCode(session_id: number, code: string) {
  return apiFetch(`/attendance/mark/${session_id}`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// Student gets list of session IDs they have attended
export async function getMyAttendedSessions(): Promise<number[]> {
  return apiFetch("/attendance/my-sessions");
}

// Tutor gets attendance list for a session
export async function getSessionAttendance(session_id: number) {
  return apiFetch(`/attendance/session/${session_id}/students`);
}

// =============================================================================
// ADMIN
// =============================================================================

export interface AdminStats {
  total_students: number;
  total_tutors: number;
  total_courses: number;
  total_sessions: number;
  total_enrollments: number;
  total_ai_queries: number;
  total_assignments: number;
  total_submissions: number;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "student" | "tutor" | "admin";
}

export interface AdminEnrollment {
  enrollment_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  course_id: number;
  course_title: string;
  enrolled_at: string;
}

export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch("/admin/stats");
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  return apiFetch("/admin/users");
}

export async function deleteAdminUser(user_id: number) {
  return apiFetch(`/admin/users/${user_id}`, { method: "DELETE" });
}

export async function updateUserRole(user_id: number, role: string) {
  return apiFetch(`/admin/users/${user_id}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

export async function getAdminEnrollments(): Promise<AdminEnrollment[]> {
  return apiFetch("/admin/enrollments");
}

export async function deleteAdminEnrollment(enrollment_id: number) {
  return apiFetch(`/admin/enrollments/${enrollment_id}`, { method: "DELETE" });
}

export async function adminDeleteCourse(course_id: number) {
  return apiFetch(`/admin/courses/${course_id}`, { method: "DELETE" });
}

// =============================================================================
// COURSE DETAIL
// =============================================================================

export interface CourseDetail {
  id: number;
  title: string;
  description: string;
  tutor_id: number;
  tutor_name: string;
  enrollment_count: number;
  materials_count: number;
  sessions_count: number;
  is_enrolled: boolean;
}

export async function getCourseDetail(course_id: number): Promise<CourseDetail> {
  return apiFetch(`/courses/${course_id}/detail`);
}

export interface StudyGuide {
  course_id: number;
  course_title: string;
  content: string;
}

export async function generateStudyGuide(course_id: number, force = false): Promise<StudyGuide> {
  const query = force ? "?force=true" : "";
  return apiFetch(`/courses/${course_id}/study-guide${query}`, { method: "POST" });
}

export interface PracticeQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface PracticeHistoryItem {
  question: string;
  was_correct: boolean;
}

export async function generatePracticeQuestion(
  course_id: number,
  history: PracticeHistoryItem[] = []
): Promise<PracticeQuestion> {
  return apiFetch(`/courses/${course_id}/practice/generate`, {
    method: "POST",
    body: JSON.stringify({ history }),
  });
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export interface Notification {
  id: number;
  message: string;
  notif_type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export async function getNotifications(): Promise<Notification[]> {
  return apiFetch("/notifications/");
}

export async function getUnreadCount(): Promise<{ count: number }> {
  return apiFetch("/notifications/unread-count");
}

export async function markNotificationRead(id: number) {
  return apiFetch(`/notifications/${id}/read`, { method: "PUT" });
}

export async function markAllNotificationsRead() {
  return apiFetch("/notifications/read-all", { method: "PUT" });
}

export async function deleteNotification(id: number) {
  return apiFetch(`/notifications/${id}`, { method: "DELETE" });
}

// =============================================================================
// QUIZZES
// =============================================================================

export interface QuizQuestion {
  question: string;
  options: string[];
  // correct_index and explanation are intentionally NOT exposed to students
  // before submission — they're returned in the attempt result instead.
}

export interface Quiz {
  id: number;
  course_id: number;
  title: string;
  questions: QuizQuestion[];
  created_at: string;
}

export interface QuizSummary {
  id: number;
  course_id: number;
  title: string;
  question_count: number;
  created_at: string;
  my_best_score: number | null;
}

export interface AttemptResult {
  score: number;
  total: number;
  correct: number;
  per_question: {
    correct: boolean;
    chosen: number;
    correct_index: number;
    explanation: string;
  }[];
}

export async function generateQuiz(course_id: number): Promise<Quiz> {
  return apiFetch(`/quizzes/generate/${course_id}`, { method: "POST" });
}

export async function getCourseQuizzes(course_id: number): Promise<QuizSummary[]> {
  return apiFetch(`/quizzes/course/${course_id}`);
}

export async function getQuiz(quiz_id: number): Promise<Quiz> {
  return apiFetch(`/quizzes/${quiz_id}`);
}

export async function submitQuizAttempt(quiz_id: number, answers: number[]): Promise<AttemptResult> {
  return apiFetch(`/quizzes/${quiz_id}/attempt`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function deleteQuiz(quiz_id: number) {
  return apiFetch(`/quizzes/${quiz_id}`, { method: "DELETE" });
}

export interface MyFocus {
  topic: string;
  quiz_id: number;
  quiz_title: string;
  course_id: number;
  course_title: string;
  wrong_count: number;
}

export async function getMyFocus(): Promise<MyFocus | null> {
  return apiFetch("/quizzes/my-focus");
}

export interface ClassWeaknessItem {
  quiz_id: number;
  quiz_title: string;
  question_index: number;
  topic: string;
  question: string;
  correct_answer: string;
  total_attempts: number;
  wrong_count: number;
  wrong_pct: number;
  most_common_wrong: {
    option_index: number;
    option_text: string;
    count: number;
  } | null;
}

export async function getClassWeaknessAnalysis(course_id: number): Promise<ClassWeaknessItem[]> {
  return apiFetch(`/quizzes/course/${course_id}/weakness-analysis`);
}

export async function explainQuizMistake(
  quiz_id: number,
  question_index: number,
  chosen_index: number
): Promise<{ explanation: string }> {
  return apiFetch(`/quizzes/${quiz_id}/explain-mistake`, {
    method: "POST",
    body: JSON.stringify({ question_index, chosen_index }),
  });
}

// =============================================================================
// PROGRESS (tutor view)
// =============================================================================

export interface StudentCourseProgress {
  student_id: number;
  name: string;
  email: string;
  sessions_attended: number;
  total_sessions: number;
  assignments_submitted: number;
  total_assignments: number;
  ai_questions_asked: number;
  average_grade: number | null;
  enrolled_at: string;
}

export async function getTutorCourseProgress(course_id: number): Promise<StudentCourseProgress[]> {
  return apiFetch(`/progress/course/${course_id}`);
}

export async function getMyProgress(): Promise<any> {
  return apiFetch(`/progress/me`);
}

// =============================================================================
// PROGRAMS, SCHEDULING, FINANCIER
// =============================================================================

export interface Program {
  id: number;
  course_id: number;
  course_title: string;
  name: string;
  session_type: "individual" | "group";
  sessions_per_week: number;
  session_duration_minutes: number;
  price_per_month: number;
  max_students_per_class: number;
}

export async function getPrograms(course_id?: number): Promise<Program[]> {
  const q = course_id ? `?course_id=${course_id}` : "";
  return apiFetch(`/programs/${q}`);
}

export async function getProgram(id: number): Promise<Program> {
  return apiFetch(`/programs/${id}`);
}

export interface TimeSlotOption {
  tutor_id: number;
  tutor_name: string;
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  available_seats: number;
  existing_class_id: number | null;
  is_full: boolean;
}

export async function getAvailableSlots(program_id: number): Promise<TimeSlotOption[]> {
  return apiFetch(`/scheduling/programs/${program_id}/available-slots`);
}

export interface BookedSlot {
  tutor_id: number;
  day_of_week: number;
  start_time: string;
}

export async function enrollInProgram(program_id: number, slots: BookedSlot[]) {
  return apiFetch(`/scheduling/programs/${program_id}/enroll`, {
    method: "POST",
    body: JSON.stringify({ program_id, slots }),
  });
}

export interface MyScheduleClass {
  scheduled_class_id: number;
  program_enrollment_id: number;
  course_title: string;
  program_name: string;
  tutor_id: number;
  tutor_name: string;
  day_of_week: number;
  day_name: string;
  start_time: string;
  duration_minutes: number;
  session_type: "individual" | "group";
}

export async function getMySchedule(): Promise<MyScheduleClass[]> {
  return apiFetch("/scheduling/my-schedule");
}

export interface MyEnrollment {
  enrollment_id: number;
  program_id: number;
  program_name: string;
  course_title: string;
  session_type: string;
  sessions_per_week: number;
  price_per_month: number;
  amount_paid: number;
  payment_status: "paid" | "pending" | "overdue";
  payment_due_date: string | null;
  enrolled_at: string;
}

export async function getMyEnrollmentsWithPayment(): Promise<MyEnrollment[]> {
  return apiFetch("/scheduling/my-enrollments");
}

export async function studentMarkPaid(enrollment_id: number) {
  return apiFetch(`/scheduling/my-enrollments/${enrollment_id}/mark-paid`, { method: "POST" });
}

export interface ScheduledClassOut {
  id: number;
  tutor_id: number;
  tutor_name: string;
  program_id: number;
  program_name: string;
  course_id: number;
  course_title: string;
  day_of_week: number;
  day_name: string;
  start_time: string;
  duration_minutes: number;
  session_type: "individual" | "group";
  max_students: number;
  current_students: number;
  students: { id: number; name: string; email: string; payment_status: string }[];
}

export async function getTutorSchedule(): Promise<ScheduledClassOut[]> {
  return apiFetch("/scheduling/tutor-schedule");
}

export async function getMasterSchedule(): Promise<ScheduledClassOut[]> {
  return apiFetch("/scheduling/master-schedule");
}

export async function rescheduleClass(id: number, new_day_of_week: number, new_start_time: string) {
  return apiFetch(`/scheduling/scheduled-classes/${id}/reschedule`, {
    method: "PUT",
    body: JSON.stringify({ new_day_of_week, new_start_time }),
  });
}

export interface AvailabilityBlock {
  id: number;
  tutor_id: number;
  tutor_name: string;
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
}

export async function getMyAvailability(): Promise<AvailabilityBlock[]> {
  return apiFetch("/scheduling/availability/me");
}

export async function addAvailability(day_of_week: number, start_time: string, end_time: string): Promise<AvailabilityBlock> {
  return apiFetch("/scheduling/availability", {
    method: "POST",
    body: JSON.stringify({ day_of_week, start_time, end_time }),
  });
}

export async function deleteAvailability(id: number) {
  return apiFetch(`/scheduling/availability/${id}`, { method: "DELETE" });
}

// Financier
export interface RevenueSummary {
  total_revenue: number;
  total_pending: number;
  total_overdue: number;
  paid_count: number;
  pending_count: number;
  overdue_count: number;
  active_enrollments: number;
}

export interface PaymentRow {
  enrollment_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  program_id: number;
  program_name: string;
  course_title: string;
  price_per_month: number;
  amount_paid: number;
  payment_status: "paid" | "pending" | "overdue";
  payment_due_date: string | null;
  enrolled_at: string;
}

export interface TutorEarningsRow {
  tutor_id: number;
  tutor_name: string;
  student_count: number;
  active_classes: number;
  monthly_revenue: number;
}

export async function getRevenue(): Promise<RevenueSummary> {
  return apiFetch("/financier/revenue");
}

export async function getPayments(status?: string): Promise<PaymentRow[]> {
  const q = status ? `?status_filter=${status}` : "";
  return apiFetch(`/financier/payments${q}`);
}

export async function updatePayment(enrollment_id: number, payment_status: string, amount_paid?: number) {
  return apiFetch(`/financier/payments/${enrollment_id}`, {
    method: "PUT",
    body: JSON.stringify({ payment_status, amount_paid }),
  });
}

export async function remindPayment(enrollment_id: number) {
  return apiFetch(`/financier/payments/${enrollment_id}/remind`, { method: "POST" });
}

export async function getTutorEarnings(): Promise<TutorEarningsRow[]> {
  return apiFetch("/financier/tutor-earnings");
}
 