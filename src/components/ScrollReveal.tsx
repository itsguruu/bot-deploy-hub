import { useEffect, useRef, useState, type ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "fade";
}

export function ScrollReveal({ children, className = "", delay = 0, direction = "up" }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const base = "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]";
  const hidden = {
    up: "opacity-0 translate-y-5 blur-[4px]",
    left: "opacity-0 -translate-x-5",
    right: "opacity-0 translate-x-5",
    fade: "opacity-0 blur-[4px]",
  }[direction];

  return (
    <div
      ref={ref}
      className={`${base} ${visible ? "opacity-100 translate-y-0 translate-x-0 blur-0" : hidden} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
