"use client";

import { useEffect } from "react";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import { auth } from "@/lib/firebase";

const FirebaseErrorListener = () => {
  useEffect(() => {
    const handlePermissionError = (...args: unknown[]) => {
      const maybeError = args[0];
      if (!(maybeError instanceof FirestorePermissionError)) {
        return;
      }

      void (async () => {
        const currentUser = auth.currentUser;
        const idTokenResult = currentUser
          ? await currentUser.getIdTokenResult()
          : null;

        if (!currentUser) {
          // Skip noisy console output for unauthenticated requests.
          return;
        }

        const contextualDetails = {
          auth: {
            uid: currentUser?.uid || "Not Authenticated",
            token: idTokenResult?.claims || "No Token",
          },
          method: maybeError.context.operation,
          path: `/databases/(default)/documents/${maybeError.context.path}`,
          request: {
            resource: {
              data: maybeError.context.requestResourceData || "N/A",
            },
          },
        };

        // Keep diagnostics in console, but avoid crashing the UI with a thrown error.
        console.error(
          `FirestoreError: Missing or insufficient permissions:\n${JSON.stringify(
            contextualDetails,
            null,
            2,
          )}`,
        );

        console.warn(
          "Authenticated Firestore request denied. Check Security Rules for this path.",
        );
      })();
    };

    errorEmitter.on("permission-error", handlePermissionError);

    return () => {
      errorEmitter.off("permission-error", handlePermissionError);
    };
  }, []);

  return null; // This component does not render anything
};

export default FirebaseErrorListener;
