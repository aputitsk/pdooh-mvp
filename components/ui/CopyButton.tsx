import type { ButtonHTMLAttributes } from "react";

type CopyButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children" | "type"
> & {
  ariaLabel: string;
  iconClassName?: string;
};

export default function CopyButton({
  ariaLabel,
  className,
  iconClassName = "h-3.5 w-3.5",
  ...buttonProps
}: CopyButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      {...buttonProps}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className={iconClassName}
      >
        <path
          d="M7 7.5A1.5 1.5 0 0 1 8.5 6h6A1.5 1.5 0 0 1 16 7.5v6a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 7 13.5v-6Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M4 12.5v-7A1.5 1.5 0 0 1 5.5 4h7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
