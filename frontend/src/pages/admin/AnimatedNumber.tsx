import React, { useEffect, useRef, useState } from "react";

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

const AnimatedNumber: React.FC<{ value: number; duration?: number }> = ({ value, duration = 700 }) => {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const mountedOnce = useRef(false);

  useEffect(() => {
    const from = mountedOnce.current ? fromRef.current : 0;
    const to = value;
    mountedOnce.current = true;
    if (from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    let start: number | null = null;
    let raf = 0;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min(1, (ts - start) / duration);
      const eased = easeOutExpo(progress);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <>{display.toLocaleString("sr-Latn-RS")}</>;
};

export default AnimatedNumber;
