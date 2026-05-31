// src/components/AskAISection.tsx
import FadeInSection from "./FadeInSection";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { Bot } from "lucide-react";
import { isLoggedIn } from "@/lib/api";

const AskAISection = () => {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  return (
    <section id="ask-ai" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <FadeInSection>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Ask Our <span className="text-sat-primary">AI Assistant</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-8">
              Get instant answers to your academic questions — grounded in your actual
              course materials, not the open internet.
            </p>
          </div>
        </FadeInSection>

        <FadeInSection delay={100}>
          <div className="max-w-2xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-10 text-center border border-blue-100">
            <div className="w-16 h-16 bg-sat-primary rounded-full flex items-center justify-center mx-auto mb-5">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">
              AI that knows your course
            </h3>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
              Unlike generic AI tools, our assistant reads your uploaded study materials
              and answers based only on what your tutor has provided. No hallucinations,
              no off-topic answers.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => navigate("/ai-assistant")}
                className="bg-sat-primary hover:bg-sat-secondary"
              >
                {loggedIn ? "Open AI Assistant" : "Try AI Assistant"}
              </Button>

              {/* Only show signup button when logged out */}
              {!loggedIn && (
                <Button
                  variant="outline"
                  onClick={() => navigate("/signup")}
                >
                  Create free account
                </Button>
              )}
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
};

export default AskAISection;