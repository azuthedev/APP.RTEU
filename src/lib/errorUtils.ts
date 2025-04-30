/**
 * Utility functions for error handling
 */

// Custom error types
export class ApiError extends Error {
  statusCode: number;
  data: any;
  
  constructor(message: string, statusCode = 500, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class ValidationError extends Error {
  errors: Record<string, string>;
  
  constructor(message: string, errors: Record<string, string> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

// Helper function to determine if an error is a Supabase error
export function isSupabaseError(error: any): boolean {
  return error && 
         typeof error === 'object' && 
         (error.code !== undefined || (error.error && error.status));
}

// Format error message from different sources (API, Supabase, etc.)
export function formatErrorMessage(error: any): string {
  if (!error) {
    return 'An unknown error occurred';
  }
  
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error;
  }
  
  // Handle Supabase errors
  if (isSupabaseError(error)) {
    // Handle PostgreSQL errors
    if (error.code && error.code.startsWith('22')) {
      return 'Invalid data format. Please check your inputs.';
    } else if (error.code && error.code.startsWith('23')) {
      return 'Database constraint violation. This operation cannot be completed.';
    } else if (error.code === '42P01') {
      return 'The requested resource does not exist.';
    } else if (error.code === '42501') {
      return 'You do not have permission to perform this action.';
    }
    
    // Return the error message if available
    if (error.message) {
      return error.message;
    } else if (error.error_description) {
      return error.error_description;
    } else if (error.error) {
      return typeof error.error === 'string' ? error.error : 'An error occurred';
    }
  }
  
  // Handle custom error types
  if (error instanceof ApiError) {
    return error.message;
  }
  
  if (error instanceof ValidationError) {
    return error.message;
  }
  
  if (error instanceof AuthenticationError) {
    return error.message;
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message;
  }
  
  // Return a default message for unknown error types
  return 'An unexpected error occurred';
}

// Function to extract field errors from validation errors
export function extractValidationErrors(error: any): Record<string, string> {
  if (error instanceof ValidationError) {
    return error.errors;
  }
  
  if (isSupabaseError(error) && error.details) {
    const fieldErrors: Record<string, string> = {};
    try {
      // Try to parse the details as validation errors
      const details = typeof error.details === 'string' 
        ? JSON.parse(error.details) 
        : error.details;
      
      if (Array.isArray(details)) {
        details.forEach(detail => {
          if (detail.path && detail.message) {
            fieldErrors[detail.path] = detail.message;
          }
        });
      }
      
      return fieldErrors;
    } catch {
      // If parsing fails, return an empty object
      return {};
    }
  }
  
  return {};
}