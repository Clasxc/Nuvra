// src/pages/Courses.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeInSection from "@/components/FadeInSection";
import { getCourses, getMyEnrollments, enrollInCourse, isLoggedIn, getCurrentUser } from "@/lib/api";
import type { Course, Enrollment, User } from "@/lib/api";
import { toast } from "sonner";

const Courses = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const coursesData = await getCourses();
        setCourses(coursesData);
        if (isLoggedIn()) {
          const userData = await getCurrentUser();
          setUser(userData);
          if (userData.role === "student") {
            const enrollData = await getMyEnrollments();
            setEnrollments(enrollData);
          }
        }
      } catch (e) {
        toast.error("Failed to load courses");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const enrolledIds = new Set(enrollments.map(e => e.course_id));

  const handleEnroll = async (courseId: number) => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    setEnrollingId(courseId);
    try {
      await enrollInCourse(courseId);
      setEnrollments(prev => [...prev, {
        id: Date.now(), student_id: user!.id,
        course_id: courseId, enrolled_at: new Date().toISOString(),
        course: courses.find(c => c.id === courseId)!,
      }]);
      toast.success("Enrolled successfully!");
    } catch (e: any) {
      toast.error(e.message || "Enrollment failed");
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-20">
        <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="container mx-auto px-4">
            <FadeInSection>
              <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                  Explore Our <span className="text-sat-primary">Courses</span>
                </h1>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Expert-taught courses combining live tutoring with AI-powered study tools.
                </p>
              </div>
            </FadeInSection>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-400 mb-4">No courses available yet.</p>
                {!isLoggedIn() && (
                  <button
                    onClick={() => navigate("/signup")}
                    className="bg-sat-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-sat-secondary transition-colors"
                  >
                    Sign up as a tutor to create courses
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course, index) => {
                  const isEnrolled = enrolledIds.has(course.id);
                  const isEnrolling = enrollingId === course.id;
                  const isStudent = user?.role === "student";
                  const isTutor = user?.role === "tutor" || user?.role === "admin";

                  return (
                    <FadeInSection key={course.id} delay={index * 100}>
                      <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${isEnrolled ? "border-sat-primary" : "border-gray-100"}`}>
                        <div className={`h-2 ${isEnrolled ? "bg-sat-primary" : "bg-gray-200"}`} />
                        <div className="p-6">
                          {isEnrolled && (
                            <span className="inline-block text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full mb-2">
                              Enrolled
                            </span>
                          )}
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">{course.title}</h3>
                          <p className="text-gray-500 text-sm mb-4 line-clamp-2">{course.description}</p>
                          <p className="text-xs text-gray-400 mb-4">
                            {course.sessions.length} session{course.sessions.length !== 1 ? "s" : ""} available
                          </p>

                          <div className="flex gap-2">
                            {/* View details button always shown */}
                            <button
                              onClick={() => navigate(`/courses/${course.id}`)}
                              className="border border-gray-200 text-gray-600 text-sm py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Details
                            </button>

                            {/* Student: enroll or go to dashboard */}
                            {isStudent && !isEnrolled && (
                              <button
                                onClick={() => navigate(`/enroll/${course.id}`)}
                                className="flex-1 bg-sat-primary text-white text-sm py-2 rounded-lg hover:bg-sat-secondary transition-colors"
                              >
                                Enroll &amp; pick schedule
                              </button>
                            )}
                            {isStudent && isEnrolled && (
                              <button
                                onClick={() => navigate("/dashboard")}
                                className="flex-1 bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700 transition-colors"
                              >
                                Dashboard →
                              </button>
                            )}

                            {/* Tutor/admin: view only */}
                            {isTutor && (
                              <button
                                onClick={() => navigate("/dashboard")}
                                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Manage
                              </button>
                            )}

                            {/* Not logged in */}
                            {!user && (
                              <button
                                onClick={() => navigate("/login")}
                                className="flex-1 bg-sat-primary text-white text-sm py-2 rounded-lg hover:bg-sat-secondary transition-colors"
                              >
                                Log in to enroll
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </FadeInSection>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Courses;