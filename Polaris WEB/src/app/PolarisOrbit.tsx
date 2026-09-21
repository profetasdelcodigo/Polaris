import { useMemo, useState, type CSSProperties } from "react";

type PolarisOrbitProps = {
  state?: "idle" | "listening" | "thinking" | "executing" | "speaking" | "success" | "warning" | "error" | "offline";
  mode?: "companion" | "focus" | "creative" | "research" | "operator" | "calm";
};

export function PolarisOrbit({ state = "idle", mode = "companion" }: PolarisOrbitProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const seed = useMemo(() => Array.from({ length: 18 }, (_, index) => index), []);

  return (
    <div
      className={`polaris-orbit-3d state-${state} mode-${mode}`}
      role="img"
      aria-label={`Núcleo visual de Polaris: ${state}`}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTilt({
          x: ((event.clientX - rect.left) / rect.width - 0.5) * 12,
          y: ((event.clientY - rect.top) / rect.height - 0.5) * -12,
        });
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ "--orbit-x": `${tilt.x}deg`, "--orbit-y": `${tilt.y}deg` } as CSSProperties}
    >
      <div className="polaris-orbit-glow" />
      <div className="polaris-orbit-ring ring-a" />
      <div className="polaris-orbit-ring ring-b" />
      <div className="polaris-orbit-ring ring-c" />
      <div className="polaris-orbit-core">
        <span className="polaris-orbit-star">✦</span>
      </div>
      {seed.map((item) => (
        <i
          className="polaris-orbit-particle"
          key={item}
          style={{ "--particle-i": item } as React.CSSProperties}
        />
      ))}
      <span className="polaris-orbit-label">POLARIS</span>
    </div>
  );
}
