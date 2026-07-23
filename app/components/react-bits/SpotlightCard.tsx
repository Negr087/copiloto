"use client";

// Adaptado de react-bits (https://reactbits.dev) — Components/SpotlightCard.
// Sin dependencias nuevas. A diferencia del original, no fuerza un fondo/borde
// propio: el caller trae todo el className (para no chocar con los colores
// por status del feed), y `as` permite renderizar <li> dentro de <ul>.
import React, { useRef, useState } from "react";

interface Position {
  x: number;
  y: number;
}

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: string;
  as?: "div" | "li";
  onClick?: () => void;
}

export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.15)",
  as = "div",
  onClick,
}: SpotlightCardProps) {
  const divRef = useRef<HTMLElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove: React.MouseEventHandler = (e) => {
    if (!divRef.current || isFocused) return;

    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(0.6);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => setOpacity(0.6);
  const handleMouseLeave = () => setOpacity(0);

  const Tag = as;

  return (
    <Tag
      ref={divRef as React.Ref<never>}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={"relative overflow-hidden " + className}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-in-out"
        style={{
          opacity,
          background:
            "radial-gradient(circle at " +
            position.x +
            "px " +
            position.y +
            "px, " +
            spotlightColor +
            ", transparent 80%)",
        }}
      />
      {children}
    </Tag>
  );
}
