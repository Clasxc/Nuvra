
import { useState } from "react";
import { cn } from "@/lib/utils";
import FadeInSection from "./FadeInSection";
import { askQuestion } from "@/lib/api";

const AskAISection = () => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    setError("");
    
    try {
      const response = await askQuestion(question);
      setAnswer(response.answer || "I couldn't find an answer to that question. Please try rephrasing or ask something else.");
    } catch (err) {
      console.error("Error asking question:", err);
      setError("There was an error processing your question. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="ask-ai" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <FadeInSection>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Ask Our <span className="text-sat-primary">AI Assistant</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Get instant answers to your academic questions using our AI powered by Gemini and LangChain.
            </p>
          </div>
        </FadeInSection>

        <div className="max-w-4xl mx-auto">
          <FadeInSection delay={100}>
            <div className="bg-blue-50 rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="question" className="block text-gray-700 font-medium mb-2">
                      Your Question
                    </label>
                    <textarea
                      id="question"
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-sat-primary focus:border-transparent resize-none transition-all"
                      placeholder="e.g., How do I solve quadratic equations? or What's the difference between IELTS and TOEFL?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    ></textarea>
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={isLoading || !question.trim()}
                      className={cn(
                        "px-6 py-3 bg-sat-primary text-white rounded-lg font-medium transition-colors",
                        "flex items-center justify-center",
                        (isLoading || !question.trim()) ? "opacity-70 cursor-not-allowed" : "hover:bg-sat-secondary"
                      )}
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        "Ask Question"
                      )}
                    </button>
                  </div>
                </form>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}

                {answer && (
                  <div className="mt-8">
                    <h3 className="text-xl font-semibold mb-3 text-gray-800">AI Assistant's Answer:</h3>
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-gray-700 whitespace-pre-wrap">{answer}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </FadeInSection>

          <FadeInSection delay={200}>
            <div className="mt-12 text-center">
              <p className="text-gray-600 mb-6">
                Need to upload your own study materials for AI to analyze?
              </p>
              <button className="px-6 py-3 border-2 border-sat-primary text-sat-primary rounded-lg font-medium hover:bg-sat-accent transition-colors">
                Try Document Upload
              </button>
            </div>
          </FadeInSection>
        </div>
      </div>
    </section>
  );
};

export default AskAISection;
