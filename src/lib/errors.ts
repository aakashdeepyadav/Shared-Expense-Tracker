
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const { path, operation, requestResourceData } = context;
    const requestDetails = JSON.stringify(
      {
        path,
        operation,
        requestResourceData: requestResourceData ?? 'No data provided',
      },
      null,
      2
    );

    super(
      `Firestore operation '${operation}' on path '${path}' was denied by security rules. Request details: \n${requestDetails}`
    );
    
    this.name = 'FirestorePermissionError';
    this.context = context;
    
    // This is to ensure the stack trace is captured correctly
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FirestorePermissionError);
    }
  }
}

    