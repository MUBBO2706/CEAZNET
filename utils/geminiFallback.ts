import { GoogleGenAI } from '@google/genai';

// The list of fallback models in priority order
export const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

// Timeout duration in milliseconds
const FLASH_TIMEOUT_MS = 15000;
const PRO_TIMEOUT_MS = 35000;

function getTimeoutForModel(modelName: string): number {
  return modelName.toLowerCase().includes('pro') ? PRO_TIMEOUT_MS : FLASH_TIMEOUT_MS;
}

const dispatchStatus = (model: string, stage: 'start' | 'success' | 'fail', index: number, total: number, isPro: boolean, timeout: number) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gemini-status', {
      detail: { model, stage, index, total, isPro, timeout }
    }));
  }
};

function executeWithTimeout<T>(promise: Promise<T>, ms: number, modelName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout of ${ms}ms exceeded while waiting for model "${modelName}"`));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

let isPatched = false;

export function initGeminiFallback() {
  if (isPatched) return;
  isPatched = true;

  try {
    console.log('[Gemini Fallback] Initializing global fallback and rotation patch...');

    // Safe guard for browser environment to avoid throwing if GoogleGenAI is not constructible client-side
    let dummyInstance: any;
    try {
      dummyInstance = new GoogleGenAI({ apiKey: 'dummy' });
    } catch (e) {
      console.warn('[Gemini Fallback] Failed to construct GoogleGenAI instance on startup:', e);
      return;
    }

    if (!dummyInstance || !dummyInstance.models) {
      console.warn('[Gemini Fallback] GoogleGenAI instance or models object is not available.');
      return;
    }

    const proto = Object.getPrototypeOf(dummyInstance.models);
    if (!proto || !proto.constructor) {
      console.warn('[Gemini Fallback] Could not retrieve Models prototype.');
      return;
    }

    const ModelsClass = proto.constructor;

    // 1. Patch generateContentInternal (for non-streaming)
    const originalGenerateContentInternal = ModelsClass.prototype.generateContentInternal;
    if (typeof originalGenerateContentInternal === 'function') {
      ModelsClass.prototype.generateContentInternal = async function (params: any, ...args: any[]) {
        const initialModel = params?.model;
        
        const modelsToTry: string[] = [];
        if (initialModel) {
          modelsToTry.push(initialModel);
        }
        for (const model of FALLBACK_MODELS) {
          if (model !== initialModel) {
            modelsToTry.push(model);
          }
        }
        if (modelsToTry.length === 0) {
          modelsToTry.push('gemini-3.8-flash');
        }

        let lastError: any = null;
        for (let i = 0; i < modelsToTry.length; i++) {
          const currentModel = modelsToTry[i];
          const isProModel = currentModel.toLowerCase().includes('pro');
          const activeTimeout = getTimeoutForModel(currentModel);
          console.log(`[Gemini Fallback] [generateContent] Attempt ${i + 1}/${modelsToTry.length} using model "${currentModel}" (Initial: "${initialModel}") with timeout ${activeTimeout}ms`);
          
          dispatchStatus(currentModel, 'start', i, modelsToTry.length, isProModel, activeTimeout);

          const controller = new AbortController();
          try {
            const clonedParams = { 
              ...params, 
              model: currentModel,
              config: {
                ...params?.config,
                abortSignal: controller.signal
              }
            };
            // Wrap the network request with our custom timeout
            const result = await executeWithTimeout(
              originalGenerateContentInternal.call(this, clonedParams, ...args),
              activeTimeout,
              currentModel
            );
            if (i > 0) {
              console.log(`[Gemini Fallback] [generateContent] Success with fallback model "${currentModel}" after ${i} failure(s).`);
            }
            dispatchStatus(currentModel, 'success', i, modelsToTry.length, isProModel, activeTimeout);
            return result;
          } catch (err: any) {
            try {
              controller.abort();
            } catch (e) {
              // Ignore abort failure
            }
            console.error(`[Gemini Fallback] [generateContent] Failed with model "${currentModel}":`, err?.message || err);
            dispatchStatus(currentModel, 'fail', i, modelsToTry.length, isProModel, activeTimeout);
            lastError = err;
            // Continue to next model
          }
        }
        throw lastError;
      };
      console.log('[Gemini Fallback] Successfully patched generateContentInternal');
    }

    // 2. Patch generateContentStreamInternal (for streaming)
    const originalGenerateContentStreamInternal = ModelsClass.prototype.generateContentStreamInternal;
    if (typeof originalGenerateContentStreamInternal === 'function') {
      ModelsClass.prototype.generateContentStreamInternal = async function (params: any, ...args: any[]) {
        const initialModel = params?.model;
        
        const modelsToTry: string[] = [];
        if (initialModel) {
          modelsToTry.push(initialModel);
        }
        for (const model of FALLBACK_MODELS) {
          if (model !== initialModel) {
            modelsToTry.push(model);
          }
        }
        if (modelsToTry.length === 0) {
          modelsToTry.push('gemini-3.8-flash');
        }

        let lastError: any = null;
        for (let i = 0; i < modelsToTry.length; i++) {
          const currentModel = modelsToTry[i];
          const isProModel = currentModel.toLowerCase().includes('pro');
          const activeTimeout = getTimeoutForModel(currentModel);
          console.log(`[Gemini Fallback] [generateContentStream] Attempt ${i + 1}/${modelsToTry.length} using model "${currentModel}" (Initial: "${initialModel}") with timeout ${activeTimeout}ms`);
          
          dispatchStatus(currentModel, 'start', i, modelsToTry.length, isProModel, activeTimeout);

          const controller = new AbortController();
          try {
            const clonedParams = { 
              ...params, 
              model: currentModel,
              config: {
                ...params?.config,
                abortSignal: controller.signal
              }
            };
            // Wrap the stream initialization connection with our custom timeout
            const result = await executeWithTimeout(
              originalGenerateContentStreamInternal.call(this, clonedParams, ...args),
              activeTimeout,
              currentModel
            );
            if (i > 0) {
              console.log(`[Gemini Fallback] [generateContentStream] Success with fallback model "${currentModel}" after ${i} failure(s).`);
            }
            dispatchStatus(currentModel, 'success', i, modelsToTry.length, isProModel, activeTimeout);
            return result;
          } catch (err: any) {
            try {
              controller.abort();
            } catch (e) {
              // Ignore abort failure
            }
            console.error(`[Gemini Fallback] [generateContentStream] Failed with model "${currentModel}":`, err?.message || err);
            dispatchStatus(currentModel, 'fail', i, modelsToTry.length, isProModel, activeTimeout);
            lastError = err;
            // Continue to next model
          }
        }
        throw lastError;
      };
      console.log('[Gemini Fallback] Successfully patched generateContentStreamInternal');
    }

    console.log('[Gemini Fallback] Global fallback and rotation patch initialized successfully.');
  } catch (error) {
    console.error('[Gemini Fallback] Failed to initialize fallback patch:', error);
  }
}
