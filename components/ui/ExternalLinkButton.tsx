import type { AnchorHTMLAttributes } from "react";

type ExternalLinkButtonProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "aria-label" | "children"
> & {
  ariaLabel: string;
  iconClassName?: string;
};

export default function ExternalLinkButton({
  ariaLabel,
  className,
  iconClassName = "h-3.5 w-3.5",
  rel = "noreferrer",
  target = "_blank",
  ...anchorProps
}: ExternalLinkButtonProps) {
  return (
    <a
      aria-label={ariaLabel}
      className={className}
      rel={rel}
      target={target}
      {...anchorProps}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className={iconClassName}
      >
        <path
          d="M8 5H5.5A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16h8a1.5 1.5 0 0 0 1.5-1.5V12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M11 4h5v5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m10 10 5.5-5.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </a>
  );
}
