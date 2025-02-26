import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TypographyProps extends HTMLAttributes<HTMLHeadingElement> {
  className?: string;
}

export function H1({ className, ...props }: TypographyProps) {
  return (
    <h1 
      className={cn(
        "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
        className
      )}
      {...props}
    />
  );
}

export function H2({ className, ...props }: TypographyProps) {
  return (
    <h2
      className={cn(
        "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
        className
      )}
      {...props}
    />
  );
}

export function H3({ className, ...props }: TypographyProps) {
  return (
    <h3
      className={cn(
        "scroll-m-20 text-2xl font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  );
}

export function H4({ className, ...props }: TypographyProps) {
  return (
    <h4
      className={cn(
        "scroll-m-20 text-xl font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  );
}

export function Paragraph({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("leading-7 [&:not(:first-child)]:mt-6", className)}
      {...props}
    />
  );
}

export function BlockQuote({ className, ...props }: HTMLAttributes<HTMLQuoteElement>) {
  return (
    <blockquote
      className={cn(
        "mt-6 border-l-2 pl-6 italic",
        className
      )}
      {...props}
    />
  );
} 