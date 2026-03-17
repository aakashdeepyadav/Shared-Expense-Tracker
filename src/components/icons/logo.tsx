import type { HTMLAttributes } from "react";

type LogoProps = Omit<HTMLAttributes<HTMLDivElement>, "children">;

export function Logo(props: LogoProps) {
  const mergedClassName = `inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-white ${props.className || "h-8 w-8"}`;

  return (
    <div
      {...props}
      aria-label="Shared Expense Tracker Logo"
      className={mergedClassName}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-[70%] w-[70%]"
        fill="none"
      >
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="5"
          stroke="currentColor"
          strokeWidth="1.8"
          opacity="0.95"
        />
        <path
          d="M7.5 9.2h9M7.5 12h9M7.5 14.8h5.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="16.9" cy="14.8" r="2.7" fill="currentColor" />
        <path
          d="M16.9 13.5v2.6M15.6 14.8h2.6"
          stroke="#0f766e"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
