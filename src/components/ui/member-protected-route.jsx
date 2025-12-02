import React from 'react';
import { useMember } from '../integrations';
import { SignIn } from '../ui/sign-in';
import { LoadingSpinner } from '../ui/loading-spinner';

export function MemberProtectedRoute({
  children,
  messageToSignIn = "Please sign in to access this page.",
  messageToLoading = "Loading page...",
  signInTitle = "Sign In Required",
  signInClassName = "",
  loadingClassName = "",
  signInProps = {},
  loadingSpinnerProps = {}
}) {
  const { isAuthenticated, isLoading } = useMember();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LoadingSpinner
          message={messageToLoading}
          className={loadingClassName}
          {...loadingSpinnerProps}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SignIn
          title={signInTitle}
          message={messageToSignIn}
          className={signInClassName}
          {...signInProps}
        />
      </div>
    );
  }

  return <>{children}</>;
}
