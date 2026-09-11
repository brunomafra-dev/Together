import type { PropsWithChildren, SVGProps } from "react";

type TogetherIconProps = Omit<SVGProps<SVGSVGElement>, "children">;

function IconFrame({ children, ...props }: PropsWithChildren<TogetherIconProps>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function TogetherMarkIcon(props: TogetherIconProps) {
  return (
    <IconFrame fill="currentColor" stroke="none" {...props}>
      <path d="M5.4 4.25h3.75c.48 0 .94.17 1.29.5L12 6.18l1.56-1.43c.35-.33.81-.5 1.29-.5h3.75a1.9 1.9 0 0 1 1.9 1.9v.45a1.9 1.9 0 0 1-1.9 1.9h-4.15v9.3a2.45 2.45 0 0 1-4.9 0V8.5H5.4a1.9 1.9 0 0 1-1.9-1.9v-.45a1.9 1.9 0 0 1 1.9-1.9Z" />
    </IconFrame>
  );
}

export function CurrentCycleIcon(props: TogetherIconProps) {
  return (
    <IconFrame {...props}>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
      <path d="M7.5 15h2l1.7-2.4 1.8 3.9 1.5-2H17" />
    </IconFrame>
  );
}

export function MilestonesIcon(props: TogetherIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 20V4" />
      <path d="M5 5h10l-1.75 3L15 11H5" />
      <path d="M8.5 19h3v-3h3v-3h3" />
    </IconFrame>
  );
}

export function CommitmentsIcon(props: TogetherIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M7 7V6.5A2.5 2.5 0 0 1 9.5 4h7A2.5 2.5 0 0 1 19 6.5V15" />
      <rect x="4" y="7" width="16" height="12" rx="2.5" />
      <path d="M4 11h16M8 15h4" />
    </IconFrame>
  );
}

export function ProjectionIcon(props: TogetherIconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.5 4.5v15h15" />
      <path d="m7 16 3.5-3.5 3 1.5L19 8.5" />
      <path d="M15.5 8.5H19V12" />
    </IconFrame>
  );
}

export function HouseholdIcon(props: TogetherIconProps) {
  return (
    <IconFrame {...props}>
      <path d="m3.5 10.5 8.5-6.5 8.5 6.5" />
      <path d="M5.5 9v11h13V9" />
      <circle cx="9.5" cy="12.5" r="1.4" />
      <circle cx="14.5" cy="12.5" r="1.4" />
      <path d="M7.5 18c.3-2 1-3 2-3s1.7 1 2 3M12.5 18c.3-2 1-3 2-3s1.7 1 2 3" />
    </IconFrame>
  );
}
