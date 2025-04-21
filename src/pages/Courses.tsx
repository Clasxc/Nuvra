
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeInSection from "@/components/FadeInSection";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface CourseCategory {
  id: string;
  title: string;
  description: string;
  image: string;
  courses: Course[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  duration: string;
  level: string;
}

const courseCategories: CourseCategory[] = [
  {
    id: "sat",
    title: "SAT Preparation",
    description: "Comprehensive preparation for the SAT exam with personalized study plans and practice tests.",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1622&q=80",
    courses: [
      {
        id: "sat-math",
        title: "SAT Math Intensive",
        description: "Master all math concepts tested on the SAT",
        duration: "8 weeks",
        level: "Intermediate"
      },
      {
        id: "sat-verbal",
        title: "SAT Reading & Writing",
        description: "Improve your verbal reasoning and writing skills",
        duration: "8 weeks",
        level: "All levels"
      },
      {
        id: "sat-complete",
        title: "Complete SAT Preparation",
        description: "Comprehensive preparation covering all SAT sections",
        duration: "12 weeks",
        level: "All levels"
      }
    ]
  },
  {
    id: "ielts",
    title: "IELTS Mastery",
    description: "Expert-led IELTS preparation focusing on all four skills with realistic practice and feedback.",
    image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80",
    courses: [
      {
        id: "ielts-speaking",
        title: "IELTS Speaking Skills",
        description: "Develop confidence and fluency for the speaking section",
        duration: "6 weeks",
        level: "Intermediate"
      },
      {
        id: "ielts-writing",
        title: "IELTS Writing Masterclass",
        description: "Learn strategies for both Task 1 and Task 2",
        duration: "6 weeks",
        level: "Intermediate"
      },
      {
        id: "ielts-complete",
        title: "Complete IELTS Preparation",
        description: "Comprehensive preparation for all IELTS sections",
        duration: "10 weeks",
        level: "All levels"
      }
    ]
  },
  {
    id: "general-english",
    title: "General English",
    description: "Improve your everyday English skills for personal and professional growth.",
    image: "https://images.unsplash.com/photo-1493612276216-ee3925520721?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1464&q=80",
    courses: [
      {
        id: "english-beginner",
        title: "English for Beginners",
        description: "Start your English learning journey with confidence",
        duration: "12 weeks",
        level: "Beginner"
      },
      {
        id: "english-intermediate",
        title: "Intermediate English",
        description: "Build on your English foundations and expand your skills",
        duration: "12 weeks",
        level: "Intermediate"
      },
      {
        id: "english-advanced",
        title: "Advanced English Mastery",
        description: "Perfect your English to near-native proficiency",
        duration: "12 weeks",
        level: "Advanced"
      }
    ]
  },
  {
    id: "business-english",
    title: "Business English",
    description: "Specialized English training for workplace and professional environments.",
    image: "https://images.unsplash.com/photo-1573164713988-8665fc963095?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1469&q=80",
    courses: [
      {
        id: "business-communication",
        title: "Business Communication",
        description: "Essential skills for effective workplace communication",
        duration: "8 weeks",
        level: "Intermediate"
      },
      {
        id: "business-writing",
        title: "Professional Writing",
        description: "Master emails, reports, and business documents",
        duration: "6 weeks",
        level: "Intermediate"
      },
      {
        id: "business-presentations",
        title: "Presentation Skills",
        description: "Deliver confident and impactful business presentations",
        duration: "4 weeks",
        level: "All levels"
      }
    ]
  },
  {
    id: "college-courses",
    title: "College Courses",
    description: "University-level courses in various subjects to support your academic journey.",
    image: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80",
    courses: [
      {
        id: "calculus",
        title: "Calculus Fundamentals",
        description: "Master derivatives, integrals, and applications",
        duration: "16 weeks",
        level: "Advanced"
      },
      {
        id: "economics",
        title: "Introduction to Economics",
        description: "Learn the basics of micro and macroeconomics",
        duration: "12 weeks",
        level: "Beginner"
      },
      {
        id: "statistics",
        title: "Statistics and Data Analysis",
        description: "Develop skills in analyzing and interpreting data",
        duration: "10 weeks",
        level: "Intermediate"
      }
    ]
  },
  {
    id: "programming",
    title: "Programming",
    description: "Learn in-demand programming languages and development skills.",
    image: "https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80",
    courses: [
      {
        id: "python",
        title: "Python for Beginners",
        description: "Start your programming journey with Python",
        duration: "8 weeks",
        level: "Beginner"
      },
      {
        id: "javascript",
        title: "Web Development Fundamentals",
        description: "Learn HTML, CSS, and JavaScript for modern web apps",
        duration: "12 weeks",
        level: "Beginner"
      },
      {
        id: "data-science",
        title: "Introduction to Data Science",
        description: "Learn to analyze and visualize data with Python",
        duration: "10 weeks",
        level: "Intermediate"
      }
    ]
  }
];

const CategoryCard = ({ category }: { category: CourseCategory }) => {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  return (
    <div 
      className="relative group overflow-hidden rounded-xl shadow-lg transition-all duration-500 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => navigate(`/category/${category.id}`)}
    >
      <div className="relative h-80 overflow-hidden">
        <img 
          src={category.image} 
          alt={category.title} 
          className={cn(
            "w-full h-full object-cover transition-transform duration-700",
            isHovered ? "scale-110" : "scale-100"
          )}
        />
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 to-transparent",
          "flex flex-col justify-end p-6 transition-opacity duration-500",
          isHovered ? "opacity-100" : "opacity-90"
        )}>
          <h3 className="text-2xl font-bold text-white mb-2">{category.title}</h3>
          <p className="text-white/90 mb-4">{category.description}</p>
          
          <div className={cn(
            "transition-all duration-500 transform",
            isHovered ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          )}>
            <p className="text-sat-accent font-semibold mb-4">{category.courses.length} courses available</p>
            <button className="px-4 py-2 bg-sat-primary text-white rounded-lg hover:bg-sat-secondary transition-colors">
              Explore Courses
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Courses = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-20">
        <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="container mx-auto px-4">
            <FadeInSection>
              <div className="text-center mb-16">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                  Explore Our <span className="text-sat-primary">Courses</span>
                </h1>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Discover a wide range of courses designed to help you achieve your academic and professional goals.
                </p>
              </div>
            </FadeInSection>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courseCategories.map((category, index) => (
                <FadeInSection key={category.id} delay={index * 150}>
                  <CategoryCard category={category} />
                </FadeInSection>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Courses;
