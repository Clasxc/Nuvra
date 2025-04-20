
import { useState } from "react";
import { cn } from "@/lib/utils";
import FadeInSection from "./FadeInSection";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  image: string;
  content: string;
  improvement: string;
}

const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Emily Chen",
    role: "SAT Student",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
    content: "SAT Genius transformed my SAT prep experience. The combination of my tutor Sarah and the 24/7 AI help made a huge difference. I could practice any time and get immediate feedback.",
    improvement: "SAT Score: 1280 → 1520"
  },
  {
    id: "2",
    name: "Michael Park",
    role: "IELTS Student",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
    content: "As a non-native English speaker, IELTS was intimidating. The personalized feedback on my writing and speaking from both tutors and AI helped me identify patterns and improve quickly.",
    improvement: "IELTS Band: 6.0 → 7.5"
  },
  {
    id: "3",
    name: "Sophia Rodriguez",
    role: "Calculus Student",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=761&q=80",
    content: "I was struggling with Calculus until I found SAT Genius. Being able to upload my textbook and ask the AI specific questions about problems I was stuck on was a game-changer.",
    improvement: "Grade: C- → A"
  },
  {
    id: "4",
    name: "David Johnson",
    role: "Parent",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80",
    content: "As a parent, I appreciate the comprehensive progress reports and the blend of human teaching with AI support. It's given my daughter confidence and improved her scores dramatically.",
    improvement: "Parent of SAT Student"
  },
];

const TestimonialsSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const nextTestimonial = () => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section id="testimonials" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <FadeInSection>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Student <span className="text-sat-primary">Success Stories</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Hear from our students who have achieved remarkable results with SAT Genius.
            </p>
          </div>
        </FadeInSection>

        {/* Desktop Testimonials Grid */}
        <div className="hidden lg:grid grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <FadeInSection key={testimonial.id} delay={index * 100}>
              <div className="bg-blue-50 rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-start mb-6">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full object-cover mr-4"
                  />
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{testimonial.name}</h3>
                    <p className="text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-gray-700 mb-4 italic">"{testimonial.content}"</p>
                <div className="bg-sat-primary text-white py-2 px-4 rounded-lg inline-block">
                  {testimonial.improvement}
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>

        {/* Mobile Testimonials Carousel */}
        <div className="lg:hidden">
          <FadeInSection>
            <div className="relative bg-blue-50 rounded-xl p-8 shadow-md">
              <div className="flex items-start mb-6">
                <img
                  src={testimonials[activeIndex].image}
                  alt={testimonials[activeIndex].name}
                  className="w-16 h-16 rounded-full object-cover mr-4"
                />
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{testimonials[activeIndex].name}</h3>
                  <p className="text-gray-600">{testimonials[activeIndex].role}</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4 italic">"{testimonials[activeIndex].content}"</p>
              <div className="bg-sat-primary text-white py-2 px-4 rounded-lg inline-block">
                {testimonials[activeIndex].improvement}
              </div>

              <div className="flex justify-between mt-6">
                <button
                  onClick={prevTestimonial}
                  className="p-2 rounded-full bg-white shadow hover:bg-gray-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sat-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextTestimonial}
                  className="p-2 rounded-full bg-white shadow hover:bg-gray-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sat-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Dots indicator */}
              <div className="flex justify-center mt-4 space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      index === activeIndex ? "bg-sat-primary" : "bg-gray-300"
                    )}
                  />
                ))}
              </div>
            </div>
          </FadeInSection>
        </div>

        <FadeInSection delay={400}>
          <div className="mt-12 text-center">
            <a
              href="#"
              className="inline-flex items-center text-sat-primary hover:text-sat-secondary font-semibold transition-colors"
            >
              Read More Success Stories
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
};

export default TestimonialsSection;
