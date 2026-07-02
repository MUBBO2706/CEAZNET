
import { Transaction } from '../types';

// This service is now purely a placeholder or for potential future utility functions.
// AI Parsing features have been removed as requested.

export const validateTransaction = (t: Partial<Transaction>): boolean => {
    return !!(t.amount && t.type && t.category);
};
