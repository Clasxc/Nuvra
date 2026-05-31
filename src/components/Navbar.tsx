// src/components/Navbar.tsx
// Shows completely different navigation based on auth state:
// - Logged out: marketing links (Home, Courses, Why Us, Pricing, Ask AI)
// - Logged in: app links based on role

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { isLoggedIn, getCurrentUser, removeToken } from "@/lib/api";
import type { User } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import Logo from "@/components/Logo";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState("home");
  const navigate = useNavigate();
  const location = useLocation();

  const loggedIn = isLoggedIn();

  useEffect(() => {
    if (loggedIn) {
      getCurrentUser()
        .then(setUser)
        .catch(() => { removeToken(); setUser(null); });
    } else {
      setUser(null);
    }
  }, [location.pathname, loggedIn]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
      if (location.pathname === "/" && !loggedIn) {
        const sections = ["home", "courses", "why-us", "testimonials", "pricing", "ask-ai"];
        const current = sections.find(id => {
          const el = document.getElementById(id);
          if (el) {
            const rect = el.getBoundingClientRect();
            return rect.top <= 100 && rect.bottom >= 100;
          }
          return false;
        });
        if (current) setActiveSection(current);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname, loggedIn]);

  const handleLogout = () => {
    removeToken();
    setUser(null);
    navigate("/");
    setIsMobileMenuOpen(false);
  };

  const scrollTo = (id: string) => {
    if (location.pathname === "/") {
      const el = document.getElementById(id);
      if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
    } else {
      navigate("/", { state: { scrollToId: id } });
    }
    setIsMobileMenuOpen(false);
  };

  // App nav links per role
  const appLinks = () => {
    if (!user) return [];
    const base = [
      { label: "Dashboard", path: "/dashboard" },
      { label: "Courses", path: "/courses" },
    ];
    if (user.role === "student") {
      return [
        ...base,
        { label: "Schedule", path: "/my-schedule" },
        { label: "AI Assistant", path: "/ai-assistant" },
        { label: "Progress", path: "/progress" },
        { label: "Exams", path: "/exams" },
      ];
    }
    // Note: /quizzes/:id is accessed from course detail page, not the nav
    if (user.role === "tutor") {
      return [
        ...base,
        { label: "Schedule", path: "/tutor-schedule" },
        { label: "Exams", path: "/exams" },
        { label: "Students", path: "/students" },
      ];
    }
    if (user.role === "admin") {
      return [
        ...base,
        { label: "Operations", path: "/admin-schedule" },
        { label: "Exams", path: "/exams" },
        { label: "Students", path: "/students" },
        { label: "Admin", path: "/admin" },
      ];
    }
    return base;
  };

  // Marketing nav links
  const marketingLinks = [
    { label: "Home", id: "home" },
    { label: "Courses", id: "courses" },
    { label: "Why Us", id: "why-us" },
    { label: "Testimonials", id: "testimonials" },
    { label: "Pricing", id: "pricing" },
    { label: "Ask AI", id: "ask-ai" },
  ];

  const navBg = loggedIn
    ? "bg-white shadow-sm"
    : isScrolled ? "bg-white shadow-md" : "bg-transparent";

  return (
    <nav className={cn("fixed top-0 w-full z-50 transition-all duration-300 py-3", navBg)}>
      <div className="container mx-auto px-4 flex justify-between items-center">

        {/* Logo */}
        <button
          onClick={() => { navigate(loggedIn ? "/dashboard" : "/"); setIsMobileMenuOpen(false); }}
          className="inline-flex items-center gap-2 group"
        >
          <Logo size={32} />
          <span className="text-xl font-bold tracking-tight text-sat-primary group-hover:text-sat-secondary transition-colors">
            NUVRA
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {loggedIn ? (
            // App navigation
            appLinks().map(link => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={cn(
                  "text-sm font-medium transition-colors",
                  location.pathname === link.path
                    ? "text-sat-primary border-b-2 border-sat-primary pb-0.5"
                    : "text-gray-600 hover:text-sat-primary"
                )}
              >
                {link.label}
              </button>
            ))
          ) : (
            // Marketing navigation
            marketingLinks.map(link => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={cn(
                  "text-sm font-medium transition-colors",
                  activeSection === link.id
                    ? "text-sat-primary border-b-2 border-sat-primary pb-0.5"
                    : "text-gray-700 hover:text-sat-primary"
                )}
              >
                {link.label}
              </button>
            ))
          )}
        </div>

        {/* Auth section */}
        <div className="hidden md:flex items-center gap-3">
          {loggedIn && user ? (
            <>
              <NotificationBell />
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-sat-primary transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-sat-primary text-white text-xs font-semibold flex items-center justify-center">
                  {user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </span>
                <span className="font-medium">{user.name.split(" ")[0]}</span>
              </button>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-red-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-red-200 transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="text-sm font-medium text-gray-700 hover:text-sat-primary transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="text-sm font-medium bg-sat-primary text-white px-4 py-2 rounded-lg hover:bg-sat-secondary transition-colors"
              >
                Sign up free
              </button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
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

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg border-t border-gray-100">
          <div className="container mx-auto px-4 py-3 space-y-1">
            {loggedIn ? (
              <>
                {appLinks().map(link => (
                  <button
                    key={link.path}
                    onClick={() => { navigate(link.path); setIsMobileMenuOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                      location.pathname === link.path
                        ? "bg-blue-50 text-sat-primary font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {link.label}
                  </button>
                ))}
                <div className="border-t border-gray-100 pt-3 mt-3">
                  {user && (
                    <p className="px-3 py-1 text-xs text-gray-400">
                      Signed in as {user.name} ({user.role})
                    </p>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg mt-1"
                  >
                    Log out
                  </button>
                </div>
              </>
            ) : (
              <>
                {marketingLinks.map(link => (
                  <button
                    key={link.id}
                    onClick={() => scrollTo(link.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {link.label}
                  </button>
                ))}
                <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                  <button
                    onClick={() => { navigate("/login"); setIsMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    Log in
                  </button>
                  <button
                    onClick={() => { navigate("/signup"); setIsMobileMenuOpen(false); }}
                    className="w-full px-3 py-2.5 text-sm font-medium bg-sat-primary text-white rounded-lg hover:bg-sat-secondary"
                  >
                    Sign up free
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;