
export interface Product {
  id: string;
  originalUrl: string;
  name: string;
}

export interface GeneratedImage {
  id: string;
  productId: string; // Link to the source product
  url: string;
  type: 'original' | 'white-bg' | 'on-model' | 'model-side' | 'model-3-4' | 'model-front' | 'model-back' | 'recolor';
  timestamp: number;
  prompt?: string;
  colorName?: string;
}

export enum EditMode {
  WHITE_BG = 'white-bg',
  ON_MODEL = 'on-model',
  MODEL_SIDE = 'model-side',
  MODEL_3_4 = 'model-3-4',
  MODEL_FRONT = 'model-front',
  MODEL_BACK = 'model-back',
  COLOR_RECOLOR = 'recolor'
}

export interface ProcessingState {
  isProcessing: boolean;
  message: string;
  progress: number;
  total?: number;
  current?: number;
}
