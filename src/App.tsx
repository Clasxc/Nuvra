import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import Courses from "./pages/Courses";
import AIAssistant from "./pages/AIAssistant";
import NotFound from "./pages/NotFound";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Progress from "./pages/Progress";
import Exams from "./pages/Exams";
import Admin from "./pages/Admin";
import CourseDetail from "./pages/CourseDetail";
import QuizPage from "./pages/Quizzes";
import TutorProgress from "./pages/TutorProgress";
import Practice from "./pages/Practice";
import SchedulePicker from "./pages/SchedulePicker";
import MySchedule from "./pages/MySchedule";
import TutorSchedule from "./pages/TutorSchedule";
import AdminSchedule from "./pages/AdminSchedule";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
          <Route path="/exams" element={<ProtectedRoute><Exams /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/quizzes/:id" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute><TutorProgress /></ProtectedRoute>} />
          <Route path="/practice/:courseId" element={<ProtectedRoute><Practice /></ProtectedRoute>} />
          <Route path="/enroll/:courseId" element={<ProtectedRoute><SchedulePicker /></ProtectedRoute>} />
          <Route path="/my-schedule" element={<ProtectedRoute><MySchedule /></ProtectedRoute>} />
          <Route path="/tutor-schedule" element={<ProtectedRoute><TutorSchedule /></ProtectedRoute>} />
          <Route path="/admin-schedule" element={<ProtectedRoute><AdminSchedule /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;