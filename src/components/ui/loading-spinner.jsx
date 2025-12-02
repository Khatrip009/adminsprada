import * as React from "react";

export function LoadingSpinner({
  message = "Loading...",
  className = "min-h-screen flex items-center justify-center",
  spinnerClassName = "animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
}) {
  return (
    <div className={className}>
      <div className="flex items-center space-x-6">
        <div className={spinnerClassName}></div>
        <span className="text-lg text-foreground/50">{message}</span>
      </div>
    </div>
  );
}
