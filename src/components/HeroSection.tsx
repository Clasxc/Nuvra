
import { cn } from "@/lib/utils";
import FadeInSection from "./FadeInSection";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section 
      id="home" 
      className="min-h-screen flex items-center pt-20 pb-16 bg-gradient-to-r from-blue-50 to-indigo-50"
    >
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="lg:w-1/2">
            <FadeInSection>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-800 mb-6">
                <span className="text-sat-primary">Real Tutors.</span> <br />
                <span className="text-sat-secondary">Smarter Learning.</span> <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-sat-primary to-sat-secondary">
                  AI-Powered Success.
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-lg">
                Combining expert tutors with cutting-edge AI to deliver personalized learning experiences that help students excel in high-stakes exams.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  className={cn(
                    "px-8 py-3 bg-sat-primary text-white rounded-full",
                    "font-semibold text-center transition-all duration-300",
                    "hover:bg-sat-secondary hover:shadow-lg"
                  )}
                  onClick={() => navigate('/courses')}
                >
                  Explore Courses
                </button>
                <button 
                  className={cn(
                    "px-8 py-3 border-2 border-sat-primary text-sat-primary rounded-full",
                    "font-semibold text-center transition-all duration-300",
                    "hover:bg-sat-accent hover:border-sat-secondary hover:text-sat-secondary"
                  )}
                  onClick={() => navigate('/ai-assistant')}
                >
                  Try AI Assistant
                </button>
              </div>
            </FadeInSection>
          </div>
          
          <div className="lg:w-1/2">
            <FadeInSection delay={300}>
              <div className="relative">
                <div className="w-full h-full absolute -left-4 -top-4 border-2 border-sat-highlight rounded-xl"></div>
                <img 
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1471&q=80" 
                  alt="Students learning" 
                  className="w-full h-auto rounded-xl shadow-xl relative z-10"
                />
                <div className="absolute -right-6 -bottom-6 bg-sat-primary text-white p-4 rounded-lg shadow-lg z-20 animate-pulse-slow">
                  <p className="font-semibold">95% Success Rate</p>
                  <p className="text-sm">For SAT & IELTS Students</p>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
