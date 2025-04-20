
import { cn } from "@/lib/utils";
import FadeInSection from "./FadeInSection";

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}

const Feature = ({ icon, title, description, delay = 0 }: FeatureProps) => {
  return (
    <FadeInSection 
      delay={delay} 
      className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow group"
    >
      <div className="bg-sat-accent group-hover:bg-sat-primary p-4 rounded-full inline-block mb-4 transition-colors duration-300">
        <div className="text-sat-primary group-hover:text-white transition-colors duration-300">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-bold mb-3 text-gray-800">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </FadeInSection>
  );
};

const WhyUsSection = () => {
  return (
    <section id="why-us" className="py-20 bg-blue-50">
      <div className="container mx-auto px-4">
        <FadeInSection>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Why Choose <span className="text-sat-primary">SAT Genius</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Our unique approach combines the best of human teaching with cutting-edge AI technology
              to provide an unmatched learning experience.
            </p>
          </div>
        </FadeInSection>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Feature 
            delay={100}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
            title="Expert Human Tutors + AI"
            description="Learn from experienced tutors who know the exams inside out, with 24/7 AI support for questions at any time."
          />
          
          <Feature 
            delay={200}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            }
            title="Practice Tests & Resources"
            description="Access a library of practice tests, study materials, and real exam questions with detailed explanations and analytics."
          />
          
          <Feature 
            delay={300}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            title="Personalized Tracking"
            description="Track your progress with detailed analytics and performance metrics that evolve as you learn and improve."
          />
        </div>

        <FadeInSection delay={400}>
          <div className="mt-16 bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-8 lg:p-12">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Our AI Advantage</h3>
                <p className="text-gray-600 mb-6">
                  SAT Genius uses cutting-edge AI (Gemini + LangChain) with Retrieval-Augmented Generation (RAG) to provide
                  precise, contextual answers to your questions at any time.
                </p>
                <ul className="space-y-3">
                  {[
                    "Access 24/7 AI tutoring support",
                    "Upload study materials for AI to analyze",
                    "Get instant feedback on practice questions",
                    "Receive personalized study recommendations"
                  ].map((item, index) => (
                    <li key={index} className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sat-primary mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <button className="mt-8 px-6 py-3 bg-sat-primary text-white rounded-lg hover:bg-sat-secondary transition-colors">
                  Try AI Assistant Now
                </button>
              </div>
              <div className="bg-sat-primary">
                <img 
                  src="https://images.unsplash.com/photo-1593376893114-fbc2a76b3c25?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80" 
                  alt="AI powered learning" 
                  className="h-full w-full object-cover opacity-80"
                />
              </div>
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
};

export default WhyUsSection;
