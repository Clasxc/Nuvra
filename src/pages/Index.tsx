import AskAISection from "@/components/AskAISection";
import CoursesSection from "@/components/CoursesSection";
import DocumentUpload from "@/components/DocumentUpload";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import Navbar from "@/components/Navbar";
import PricingSection from "@/components/PricingSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import WhyUsSection from "@/components/WhyUsSection";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div>
      <Navbar />
      <HeroSection />
      <CoursesSection />
      <WhyUsSection />
      <TestimonialsSection />
      <PricingSection />
      <AskAISection />
      <DocumentUpload />
      <Footer />
      <section className="flex gap-4 mt-8 justify-center">
        <button
          className="bg-sat-primary px-6 py-3 rounded text-white text-lg font-bold hover:bg-sat-secondary transition"
          onClick={() => navigate("/courses")}
        >
          Explore Courses
        </button>
        <button
          className="bg-blue-600 px-6 py-3 rounded text-white text-lg font-bold hover:bg-blue-700 transition"
          onClick={() => navigate("/ai-assistant")}
        >
          Try AI Assistant
        </button>
      </section>
    </div>
  );
};

export default Index;
