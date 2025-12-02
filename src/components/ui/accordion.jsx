// src/components/ui/accordion.jsx
import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { cn } from "../../lib/utils";

/**
 * Accordion (Radix) wrapper tuned for Tailwind v3.5
 *
 * - Exports: Accordion, AccordionItem, AccordionTrigger, AccordionContent
 * - Uses Tailwind utility classes only (no external CSS file required).
 * - Accessible: keyboard / ARIA handled by Radix.
 *
 * Usage:
 * <Accordion type="single" collapsible>
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger>Question</AccordionTrigger>
 *     <AccordionContent>Answer</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 */

/* Tailwind-friendly animations: we use inline styles (keyframes) via class names below.
   If you prefer to add these globally, move to your global CSS. */
const ACCORDION_ANIM_CLASSES =
  "data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up";

/* Root */
const Accordion = AccordionPrimitive.Root;

/* Item */
const AccordionItem = React.forwardRef(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      "border-b border-foreground/10 last:border-b-0",
      className
    )}
    {...props}
  />
));
AccordionItem.displayName = "AccordionItem";

/* Trigger */
const AccordionTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex w-full items-center justify-between py-4 text-left text-base font-medium transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 rounded-md",
        "text-foreground hover:text-primary",
        "[&[data-state=open]>svg]:rotate-180 [&[data-state=open]>svg]:text-primary",
        className
      )}
      {...props}
    >
      <span className="flex-1 pr-4">{children}</span>
      <ChevronDownIcon className="h-5 w-5 shrink-0 transition-transform duration-200" aria-hidden />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = "AccordionTrigger";

/* Content */
const AccordionContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <>
    {/* We add a small wrapper that will animate height via CSS animations.
        The actual animations are defined below in a style tag. */}
    <style>{`
      /* Accordion animations compatible with Tailwind v3.5 (used locally) */
      @keyframes accordion-down {
        from { height: 0; opacity: 0; }
        to   { height: var(--radix-accordion-content-height); opacity: 1; }
      }
      @keyframes accordion-up {
        from { height: var(--radix-accordion-content-height); opacity: 1; }
        to   { height: 0; opacity: 0; }
      }
      .animate-accordion-down {
        animation: accordion-down 220ms cubic-bezier(.2,.8,.2,1);
        overflow: hidden;
      }
      .animate-accordion-up {
        animation: accordion-up 200ms cubic-bezier(.2,.8,.2,1);
        overflow: hidden;
      }
    `}</style>

    <AccordionPrimitive.Content
      ref={ref}
      className={cn(
        "text-sm text-foreground/90 overflow-hidden",
        "transition-[opacity,height] duration-200 ease-in-out",
        ACCORDION_ANIM_CLASSES,
        className
      )}
      {...props}
      /* Radix sets --radix-accordion-content-height for animation; keep that behavior */
    >
      <div className="pt-0 pb-4">{children}</div>
    </AccordionPrimitive.Content>
  </>
));
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
