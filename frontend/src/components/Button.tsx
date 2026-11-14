import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export default function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  return <button type={type} className={`button button-${variant} ${className}`} {...rest} />;
}
