// src/pages/AIAssistant.tsx
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AIChat } from "@/components/AIChat";
import FadeInSection from "@/components/FadeInSection";
import { useNavigate } from "react-router-dom";
import { isLoggedIn } from "@/lib/api";

const AIAssistant = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-20">
        <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="container mx-auto px-4">
            <FadeInSection>
              <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                  AI <span className="text-sat-primary">Assistant</span>
                </h1>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Ask questions about your course materials. The AI answers based only on
                  what your tutor has uploaded — accurate, focused, and always relevant.
                </p>

                {/* Show login prompt if not logged in */}
                {!isLoggedIn() && (
                  <div className="mt-6 inline-flex items-center gap-3 bg-white border border-blue-200 rounded-xl px-6 py-3 shadow-sm">
                    <p className="text-gray-600 text-sm">Log in to use the full AI assistant</p>
                    <button
                      onClick={() => navigate("/login")}
                      className="bg-sat-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-sat-secondary transition-colors"
                    >
                      Log in
                    </button>
                    <button
                      onClick={() => navigate("/signup")}
                      className="border border-sat-primary text-sat-primary text-sm px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Sign up free
                    </button>
                  </div>
                )}
              </div>
            </FadeInSection>

            <div className="max-w-4xl mx-auto">
              <FadeInSection delay={100}>
                <AIChat />
              </FadeInSection>
            </div>

            {/* How it works */}
            <FadeInSection delay={200}>
              <div className="max-w-3xl mx-auto mt-12 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-5">How it works</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { step: "1", title: "Tutor uploads materials", desc: "Your tutor uploads course PDFs, notes, or text files" },
                    { step: "2", title: "AI indexes the content", desc: "The system processes and stores the content for search" },
                    { step: "3", title: "You ask questions", desc: "Get answers grounded in your actual course materials" },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-sat-primary text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {item.step}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                        <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AIAssistant;