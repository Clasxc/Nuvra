
import FadeInSection from "./FadeInSection";
import { AIChat } from "./AIChat";

const AskAISection = () => {
  return (
    <section id="ask-ai" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <FadeInSection>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Ask Our <span className="text-sat-primary">AI Assistant</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Get instant answers to your academic questions using our AI powered by Google's Gemini.
            </p>
          </div>
        </FadeInSection>

        <div className="max-w-4xl mx-auto">
          <FadeInSection delay={100}>
            <AIChat />
          </FadeInSection>
        </div>
      </div>
    </section>
  );
};

export default AskAISection;
