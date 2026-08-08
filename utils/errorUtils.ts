
import { AppError } from '../types';

export const getFriendlyErrorMessage = (error: any): AppError => {
    const message = error.message || String(error);

    if (message.includes('API key not valid') || message.toLowerCase().includes('permission denied') || message.includes('API_KEY')) {
        return { 
            message: 'Your API key is invalid or not configured correctly. Please open the model selector to update your key.', 
        };
    }
    if (message.includes('billed users at this time')) {
        return { 
            message: 'Image generation failed. This feature requires a billing account to be set up in Google AI Studio.' 
        };
    }
    if (message.includes('429')) {
        return { message: 'You have exceeded your API quota. Please check your Google AI Studio account.' };
    }
    if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
         return { message: 'Could not connect to the service. Please check your internet connection and try again.' };
    }
    if (message.includes('timed out')) {
        return { message: 'The request timed out. Please try again.' };
    }

    return { message: 'An unexpected error occurred. Please try again later.' };
};
