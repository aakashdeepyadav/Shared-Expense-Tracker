import type { HTMLAttributes } from "react";

type LogoProps = Omit<HTMLAttributes<HTMLDivElement>, "children">;

export function Logo(props: LogoProps) {
  return (
    <div
      {...props}
      aria-label="Shared Expense Tracker Logo"
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-white font-bold ${props.className || ""}`}
    >
      <span className="text-[0.55em] tracking-[0.12em]">SET</span>
    </div>
  );
}
