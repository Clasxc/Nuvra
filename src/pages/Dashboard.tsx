
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Book, CalendarDays, Progress as ProgressIcon } from "lucide-react";

interface Course {
  id: string;
  title: string;
  progress: number;
  nextLesson: string;
  color: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  // Sample course data - in a real app, this would come from Supabase
  const courses: Course[] = [
    {
      id: "sat-prep",
      title: "SAT Preparation",
      progress: 45,
      nextLesson: "Advanced Mathematics",
      color: "bg-sat-primary",
    },
    {
      id: "ielts",
      title: "IELTS Training",
      progress: 30,
      nextLesson: "Writing Task 2",
      color: "bg-blue-600",
    },
    {
      id: "programming",
      title: "Python Programming",
      progress: 60,
      nextLesson: "Functions & Classes",
      color: "bg-purple-600",
    },
  ];

  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const upcomingDeadlines = [
    { id: 1, task: "SAT Practice Test", due: "2025-04-25" },
    { id: 2, task: "IELTS Writing Assignment", due: "2025-04-28" },
    { id: 3, task: "Programming Project", due: "2025-05-01" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Welcome back, {user.email}</h1>
          <p className="text-gray-600">Track your progress and manage your courses</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{course.title}</span>
                  <ProgressIcon className="h-5 w-5 text-gray-400" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={course.progress} className="h-2" />
                  <p className="text-sm text-gray-600">
                    Next: {course.nextLesson}
                  </p>
                  <button
                    onClick={() => navigate(`/courses/${course.id}`)}
                    className={`w-full py-2 px-4 rounded-lg text-white ${course.color} hover:opacity-90 transition-opacity`}
                  >
                    Continue Learning
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarDays className="h-5 w-5 mr-2" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingDeadlines.map((deadline) => (
                    <TableRow key={deadline.id}>
                      <TableCell>{deadline.task}</TableCell>
                      <TableCell>{deadline.due}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Book className="h-5 w-5 mr-2" />
                Study Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <button
                  onClick={() => navigate("/practice-tests")}
                  className="w-full py-2 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-left"
                >
                  Practice Tests
                </button>
                <button
                  onClick={() => navigate("/library")}
                  className="w-full py-2 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-left"
                >
                  Course Library
                </button>
                <button
                  onClick={() => navigate("/ai-assistant")}
                  className="w-full py-2 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-left"
                >
                  AI Study Assistant
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
