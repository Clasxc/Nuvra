// src/pages/Index.tsx
// Marketing landing page — only shown to logged-out users.
// Logged-in users are redirected to /dashboard immediately.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isLoggedIn } from "@/lib/api";
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
  const navigate = useNavigate();

  useEffect(() => {
    // Any logged-in user hitting / goes straight to their dashboard
    if (isLoggedIn()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  // Don't render the marketing page at all if logged in
  if (isLoggedIn()) return null;

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
    </div>
  );
};

export default Index;