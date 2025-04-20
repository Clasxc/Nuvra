
import AskAISection from "@/components/AskAISection";
import CoursesSection from "@/components/CoursesSection";
import DocumentUpload from "@/components/DocumentUpload";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import Navbar from "@/components/Navbar";
import PricingSection from "@/components/PricingSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import WhyUsSection from "@/components/WhyUsSection";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <CoursesSection />
      <WhyUsSection />
      <TestimonialsSection />
      <PricingSection />
      <AskAISection />
      <DocumentUpload />
      <Footer />
    </div>
  );
};

export default Index;
