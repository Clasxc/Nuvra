
import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <Logo size={28} />
              <h3 className="text-xl font-bold">NUVRA</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Combining expert tutors with AI technology to deliver personalized learning experiences.
            </p>
            <div className="flex space-x-4">
              {/* Social media icons */}
              {["facebook", "twitter", "instagram", "linkedin"].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-sat-primary transition-colors"
                >
                  <span className="sr-only">{social}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Courses</h3>
            <ul className="space-y-2">
              {["SAT Preparation", "IELTS Mastery", "Calculus", "Economics", "AP Courses", "College Essays"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              {["About Us", "Our Tutors", "Testimonials", "Careers", "Blog", "Contact"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              {["Terms of Service", "Privacy Policy", "Cookie Policy", "GDPR"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Newsletter</h3>
              <div className="flex">
                <input
                  type="email"
                  placeholder="Your email"
                  className="px-4 py-2 rounded-l-lg bg-gray-800 text-white border-0 focus:ring-2 focus:ring-sat-primary focus:outline-none"
                />
                <button className="bg-sat-primary text-white px-4 py-2 rounded-r-lg hover:bg-sat-secondary transition-colors">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm mb-4 md:mb-0">
              &copy; {new Date().getFullYear()} NUVRA. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white text-sm">
                Help Center
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm">
                FAQ
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm">
                Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
