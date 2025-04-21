
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AIChat } from "@/components/AIChat";
import FadeInSection from "@/components/FadeInSection";

const AIAssistant = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-20">
        <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="container mx-auto px-4">
            <FadeInSection>
              <div className="text-center mb-16">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                  AI <span className="text-sat-primary">Assistant</span>
                </h1>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Ask our AI assistant any questions about your studies. As a guest, you can try up to 3 free questions.
                </p>
              </div>
            </FadeInSection>

            <div className="max-w-4xl mx-auto">
              <FadeInSection delay={100}>
                <AIChat guestMode={true} maxQuestions={3} />
              </FadeInSection>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AIAssistant;
