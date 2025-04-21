
import FadeInSection from "./FadeInSection";
import { AIChat } from "./AIChat";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

const AskAISection = () => {
  const navigate = useNavigate();
  
  return (
    <section id="ask-ai" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <FadeInSection>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Ask Our <span className="text-sat-primary">AI Assistant</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-6">
              Get instant answers to your academic questions using our AI powered by Google's Gemini.
            </p>
            <Button 
              onClick={() => navigate('/ai-assistant')}
              className="bg-sat-primary hover:bg-sat-secondary"
            >
              Try Full AI Assistant
            </Button>
          </div>
        </FadeInSection>

        <div className="max-w-4xl mx-auto">
          <FadeInSection delay={100}>
            <AIChat guestMode={true} maxQuestions={1} />
          </FadeInSection>
        </div>
      </div>
    </section>
  );
};

export default AskAISection;
