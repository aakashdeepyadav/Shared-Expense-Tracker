
"use client";

import React, { useEffect } from 'react';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError } from '@/lib/errors';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';

const FirebaseErrorListener = () => {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = async (error: FirestorePermissionError) => {
      console.error("Caught a Firestore Permission Error:", error);

      const currentUser = auth.currentUser;
      const idTokenResult = currentUser ? await currentUser.getIdTokenResult() : null;

      // Construct a developer-friendly error message
      const contextualError = new Error(
`FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.stringify({
  auth: {
    uid: currentUser?.uid || "Not Authenticated",
    token: idTokenResult?.claims || "No Token",
  },
  method: error.context.operation,
  path: `/databases/(default)/documents/${error.context.path}`,
  request: {
    resource: {
      data: error.context.requestResourceData || "N/A"
    }
  }
}, null, 2)}`
      );

      // We throw the error here, which will be caught by Next.js's development error overlay.
      // This provides a much better debugging experience than a simple console.log or toast.
      // In a production build, this would be handled by a global error boundary.
      throw contextualError;

    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null; // This component does not render anything
};

export default FirebaseErrorListener;

    