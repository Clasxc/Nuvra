
import { useState } from "react";
import { cn } from "@/lib/utils";
import FadeInSection from "./FadeInSection";

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
}

const plans: PricingPlan[] = [
  {
    id: "basic",
    name: "Basic",
    price: "$49",
    description: "Essential preparation for one specific exam.",
    features: [
      "Access to one course of your choice",
      "AI-powered Q&A (100 questions/month)",
      "Practice tests with explanations",
      "Mobile app access",
      "Basic progress tracking"
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$89",
    description: "Comprehensive preparation with expert guidance.",
    features: [
      "Access to all courses",
      "Unlimited AI-powered Q&A",
      "2 hours of live tutoring per month",
      "Advanced analytics and tracking",
      "Personalized study plan",
      "Document upload for AI analysis",
      "Priority support"
    ],
    popular: true,
  },
  {
    id: "all-access",
    name: "All Access",
    price: "$149",
    description: "The ultimate preparation experience.",
    features: [
      "Everything in Premium",
      "5 hours of live tutoring per month",
      "Direct tutor messaging",
      "Guaranteed score improvement",
      "Additional subjects and materials",
      "Parent/guardian progress reports",
      "College application guidance"
    ],
  },
];

const PricingSection = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">("monthly");

  return (
    <section id="pricing" className="py-20 bg-blue-50">
      <div className="container mx-auto px-4">
        <FadeInSection>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Simple, Transparent <span className="text-sat-primary">Pricing</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Choose a plan that works for you. All plans include access to our AI-powered learning platform.
            </p>
            
            <div className="flex justify-center mt-8">
              <div className="inline-flex bg-gray-100 p-1 rounded-full">
                <button
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    billingCycle === "monthly"
                      ? "bg-white shadow-sm text-sat-primary"
                      : "text-gray-600 hover:text-gray-800"
                  )}
                  onClick={() => setBillingCycle("monthly")}
                >
                  Monthly
                </button>
                <button
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    billingCycle === "annually"
                      ? "bg-white shadow-sm text-sat-primary"
                      : "text-gray-600 hover:text-gray-800"
                  )}
                  onClick={() => setBillingCycle("annually")}
                >
                  Annually <span className="text-green-500 text-xs font-bold">Save 20%</span>
                </button>
              </div>
            </div>
          </div>
        </FadeInSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <FadeInSection key={plan.id} delay={index * 150}>
              <div className={cn(
                "bg-white rounded-xl overflow-hidden transition-all duration-300",
                plan.popular 
                  ? "shadow-xl ring-2 ring-sat-primary transform md:-translate-y-4"
                  : "shadow-lg hover:shadow-xl"
              )}>
                {plan.popular && (
                  <div className="bg-sat-primary text-white text-center py-2 font-medium">
                    Most Popular
                  </div>
                )}
                
                <div className="p-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-6">{plan.description}</p>
                  
                  <div className="flex items-baseline mb-6">
                    <span className="text-4xl font-bold text-gray-800">
                      {billingCycle === "annually" 
                        ? `$${Math.floor(parseInt(plan.price.substring(1)) * 0.8 * 12)}`
                        : plan.price}
                    </span>
                    <span className="text-gray-500 ml-2">/{billingCycle === "annually" ? "year" : "month"}</span>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button className={cn(
                    "w-full py-3 rounded-lg font-semibold transition-colors",
                    plan.popular
                      ? "bg-sat-primary text-white hover:bg-sat-secondary"
                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                  )}>
                    Get Started
                  </button>
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>
        
        <FadeInSection delay={400}>
          <div className="mt-16 bg-white rounded-xl shadow-lg p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Need a custom solution?</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              We offer custom plans for schools, educational institutions, and groups.
              Contact us to learn more about our enterprise solutions.
            </p>
            <button className="px-8 py-3 bg-sat-primary text-white rounded-lg hover:bg-sat-secondary transition-colors">
              Contact Sales
            </button>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
};

export default PricingSection;
