import type { ApiResult } from '../../shared/types';

declare global {
  interface Window {
    almendra: {
      invoke<T>(channel: string, payload?: unknown): Promise<ApiResult<T>>;
    };
  }
}

export {};
