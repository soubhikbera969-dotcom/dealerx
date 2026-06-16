import { useEffect, useRef } from "react";

interface TubesInstance {
  tubes: {
    setColors: (colors: string[]) => void;
    setLightsColors: (colors: string[]) => void;
  };
  dispose?: () => void;
}

interface TubesCursorProps {
  tubeColors?: string[];
  lightColors?: string[];
  lightIntensity?: number;
  className?: string;
  children?: React.ReactNode;
}

const randomColors = (count: number): string[] =>
  Array.from({ length: count }, () =>
    "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")
  );

export default function TubesCursor({
  tubeColors = ["#5e72e4", "#8965e0", "#f5365c"],
  lightColors = ["#21d4fd", "#b721ff", "#f4d03f", "#11cdef"],
  lightIntensity = 200,
  className = "",
  children,
}: TubesCursorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<TubesInstance | null>(null);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      const url = "https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js";
      (import(/* @vite-ignore */ url) as Promise<{ default: (canvas: HTMLCanvasElement, opts: unknown) => TubesInstance }>)
        .then((module) => {
          if (!canvasRef.current) return;
          appRef.current = module.default(canvasRef.current, {
            tubes: {
              colors: tubeColors,
              lights: { intensity: lightIntensity, colors: lightColors },
            },
          });
        })
        .catch((err) => console.error("Failed to load TubesCursor module:", err));
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (appRef.current?.dispose) appRef.current.dispose();
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = () => {
    if (!appRef.current) return;
    appRef.current.tubes.setColors(randomColors(3));
    appRef.current.tubes.setLightsColors(randomColors(4));
  };

  return (
    <div
      onClick={handleClick}
      className={`relative w-full h-full overflow-hidden cursor-pointer ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />
      {children && <div className="relative z-10 w-full h-full">{children}</div>}
    </div>
  );
}
