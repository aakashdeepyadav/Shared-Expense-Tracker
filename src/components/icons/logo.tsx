
import Image from "next/image";
import type { HTMLAttributes } from "react";

type LogoProps = Omit<HTMLAttributes<HTMLDivElement>, "children">;

export function Logo(props: LogoProps) {
  return (
    <Image
      src="https://raw.githubusercontent.com/skyworld-play/tifresh-app/refs/heads/main/tifresh.png"
      alt="TiFresh Logo"
      width={64}
      height={64}
      className={props.className}
      priority
    />
  );
}
