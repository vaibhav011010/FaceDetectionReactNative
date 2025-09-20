// src/types/axios.d.ts
import "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** our custom per-request owner ID */
    metadata?: { userId?: number };
    /** our retry flag */
    _retry?: boolean;
  }
}
