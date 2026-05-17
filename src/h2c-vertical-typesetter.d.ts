export type UnderlineStyle = "solid" | "double" | "thick" | "dotted" | "dashed" | "dashdot" | "wavy" | null;

export interface TextStyleRange {
  start: number;
  end: number;
  fontDelta?: number;
  bold?: boolean;
  underline?: UnderlineStyle;
  color?: string;
}

export interface VerticalTypesetOptions {
  html2canvas?: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
  styleRanges?: TextStyleRange[];
  styleRangesResolver?: (element: HTMLElement) => TextStyleRange[] | undefined;
  verticalSelector?: string;
  shouldHandleElement?: (element: HTMLElement) => boolean;
  extraTopOffset?: number | string | ((element: HTMLElement, fontSize: number) => number);
  extraTopOffsetPx?: number;
  sidewayNumericRatio?: number;
  sidewaysRunCharPattern?: RegExp;
  minFontSize?: number;
  minFontDelta?: number;
  maxFontDelta?: number;
  previewIgnoreSelector?: string;
  backgroundColor?: string | null;
  scale?: number;
  useCORS?: boolean;
  allowTaint?: boolean;
  onclone?: (document: Document, element: HTMLElement) => void;
  ignoreElements?: (element: Element) => boolean;
  [key: string]: unknown;
}

export interface PaintVerticalTextOptions extends VerticalTypesetOptions {
  pixelRatio?: number;
  selectionStart?: number;
  selectionEnd?: number;
  selectionColor?: string;
  showCaret?: boolean;
  caretColor?: string;
}

export interface VerticalTextItem {
  type: "upright" | "sideways";
  text: string;
  start: number;
  end: number;
  x: number;
  y: number;
  top: number;
  bottom: number;
  advance: number;
  fontSize: number;
  color: string;
  style: {
    fontDelta: number;
    bold: boolean;
    underline: UnderlineStyle;
    color: string | null;
  };
}

export interface VerticalTextLayout {
  visibleText: string;
  items: VerticalTextItem[];
  contentX: number;
  contentY: number;
  contentW: number;
  contentH: number;
  colAdvance?: number;
  rowAdvance?: number;
  ascent?: number;
}

export function captureWithVerticalTypeset(root: HTMLElement, options?: VerticalTypesetOptions): Promise<HTMLCanvasElement>;
export function getVerticalTextLayout(
  el: HTMLElement,
  text: string,
  options?: VerticalTypesetOptions | TextStyleRange[]
): VerticalTextLayout;
export function getVisibleVerticalText(el: HTMLElement, text: string, options?: VerticalTypesetOptions): string;
export function getVerticalTextIndexFromPoint(
  el: HTMLElement,
  text: string,
  clientX: number,
  clientY: number,
  options?: VerticalTypesetOptions
): number;
export function paintVisibleVerticalText(
  canvas: HTMLCanvasElement,
  el: HTMLElement,
  text: string,
  options?: PaintVerticalTextOptions
): void;

declare const api: {
  captureWithVerticalTypeset: typeof captureWithVerticalTypeset;
  getVerticalTextIndexFromPoint: typeof getVerticalTextIndexFromPoint;
  getVerticalTextLayout: typeof getVerticalTextLayout;
  getVisibleVerticalText: typeof getVisibleVerticalText;
  paintVisibleVerticalText: typeof paintVisibleVerticalText;
};

export default api;
