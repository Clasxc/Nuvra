
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";

interface NavLink {
  name: string;
  href: string;
  isPage?: boolean;
}

const navLinks: NavLink[] = [
  { name: "Home", href: "#home" },
  { name: "Courses", href: "#courses" },
  { name: "Why Us", href: "#why-us" },
  { name: "Testimonials", href: "#testimonials" },
  { name: "Pricing", href: "#pricing" },
  { name: "Ask AI", href: "#ask-ai" },
  { name: "All Courses", href: "/courses", isPage: true },
  { name: "AI Assistant", href: "/ai-assistant", isPage: true },
];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      // Check if page is scrolled
      setIsScrolled(window.scrollY > 10);
      
      // Only track sections on the homepage
      if (location.pathname === '/') {
        // Set active section based on scroll position
        const sections = navLinks
          .filter(link => !link.isPage)
          .map(link => link.href.substring(1));
          
        const currentSection = sections.find(section => {
          const element = document.getElementById(section);
          if (element) {
            const rect = element.getBoundingClientRect();
            return rect.top <= 100 && rect.bottom >= 100;
          }
          return false;
        });
        
        if (currentSection) {
          setActiveSection(currentSection);
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  const handleNavigation = (link: NavLink) => {
    if (link.isPage) {
      navigate(link.href);
    } else if (location.pathname === '/') {
      // If we're on the homepage, scroll to the section
      const sectionId = link.href.substring(1);
      const element = document.getElementById(sectionId);
      if (element) {
        window.scrollTo({
          top: element.offsetTop - 80,
          behavior: "smooth",
        });
      }
    } else {
      // If we're not on the homepage, navigate there and then scroll
      navigate('/', { state: { scrollToId: link.href.substring(1) } });
    }
    
    // Close mobile menu when clicking a link
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300",
        isScrolled 
          ? "bg-white shadow-md py-2" 
          : "bg-transparent py-4"
      )}
    >
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center">
          <a 
            href="#home" 
            className="text-2xl font-bold text-sat-primary"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            SAT Genius
          </a>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex space-x-6">
          {navLinks.filter(link => location.pathname === '/' ? !link.isPage : link.isPage).map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                handleNavigation(link);
              }}
              className={cn(
                "transition-colors duration-300 font-medium",
                location.pathname === '/' && activeSection === link.href.substring(1)
                  ? "text-sat-primary border-b-2 border-sat-primary"
                  : location.pathname === link.href
                  ? "text-sat-primary border-b-2 border-sat-primary"
                  : "text-gray-700 hover:text-sat-primary"
              )}
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-sat-primary"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg">
          <div className="container mx-auto px-4 py-3">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation(link);
                }}
                className={cn(
                  "block py-2 transition-colors duration-300",
                  location.pathname === '/' && activeSection === link.href.substring(1)
                    ? "text-sat-primary font-medium"
                    : location.pathname === link.href
                    ? "text-sat-primary font-medium"
                    : "text-gray-700"
                )}
              >
                {link.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
