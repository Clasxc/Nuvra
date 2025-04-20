
import { useState } from "react";
import { cn } from "@/lib/utils";
import FadeInSection from "./FadeInSection";

interface Course {
  id: string;
  title: string;
  description: string;
  image: string;
  hoverText: string;
}

const courses: Course[] = [
  {
    id: "sat",
    title: "SAT Preparation",
    description: "Comprehensive preparation for the SAT exam with personalized study plans and practice tests.",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1622&q=80",
    hoverText: "Boost your SAT score by 200+ points"
  },
  {
    id: "ielts",
    title: "IELTS Mastery",
    description: "Expert-led IELTS preparation focusing on all four skills with realistic practice and feedback.",
    image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80",
    hoverText: "Achieve Band 7+ with our guidance"
  },
  {
    id: "calculus",
    title: "Calculus Mastery",
    description: "In-depth calculus course covering derivatives, integrals, and applications with interactive problems.",
    image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80",
    hoverText: "Master calculus concepts with ease"
  }
];

const CourseCard = ({ course }: { course: Course }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative group overflow-hidden rounded-xl shadow-lg transition-all duration-500"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative h-80 overflow-hidden">
        <img 
          src={course.image} 
          alt={course.title} 
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
          <h3 className="text-2xl font-bold text-white mb-2">{course.title}</h3>
          <p className="text-white/90 mb-4">{course.description}</p>
          
          <div className={cn(
            "transition-all duration-500 transform",
            isHovered ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          )}>
            <p className="text-sat-accent font-semibold mb-4">{course.hoverText}</p>
            <div className="flex space-x-3">
              <button className="px-4 py-2 bg-sat-primary text-white rounded-lg hover:bg-sat-secondary transition-colors">
                Watch Demo
              </button>
              <button className="px-4 py-2 bg-white/20 text-white rounded-lg backdrop-blur-sm hover:bg-white/30 transition-colors">
                Meet Tutor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CoursesSection = () => {
  return (
    <section id="courses" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <FadeInSection>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Popular <span className="text-sat-primary">Courses</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Our courses combine expert human tutoring with AI-powered practice and feedback
              to maximize your learning outcomes.
            </p>
          </div>
        </FadeInSection>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((course, index) => (
            <FadeInSection key={course.id} delay={index * 150}>
              <CourseCard course={course} />
            </FadeInSection>
          ))}
        </div>
        
        <FadeInSection delay={300}>
          <div className="mt-16 text-center">
            <a 
              href="#" 
              className="inline-flex items-center text-sat-primary hover:text-sat-secondary font-semibold transition-colors"
            >
              View All Courses
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
};

export default CoursesSection;
