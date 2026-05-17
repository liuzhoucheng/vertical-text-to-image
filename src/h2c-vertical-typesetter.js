/**
 * h2c-vertical-typesetter
 *
 * Canvas-based vertical-rl text renderer for html2canvas captures.
 * It is designed for Chinese/Japanese/Korean vertical layouts where
 * browser rendering and html2canvas output do not match reliably.
 */

const DEFAULT_SIDEWAYS_RUN_RE = /^[A-Za-z0-9()[\]{}.,:;!?\-_/\\+%=#&]$/;

const DEFAULT_OPTIONS = {
  sidewayNumericRatio: 0.86,
  minFontSize: 8,
  maxFontDelta: 24,
  minFontDelta: -12,
  defaultBackgroundColor: "#fff",
  previewIgnoreSelector: ".h2c-vrl-preview,.h2c-vrl-toolbar",
};

let measureCanvas;

const getMeasureContext = () => {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d");
};

const getPxValue = (value, basePx, fallbackPx) => {
  if (!value || value === "normal") return fallbackPx ?? Math.round(basePx * 1.2);
  if (value.endsWith("px")) return parseFloat(value);
  if (value.endsWith("rem")) {
    return parseFloat(value) * parseFloat(getComputedStyle(document.documentElement).fontSize || 16);
  }
  if (value.endsWith("em")) return parseFloat(value) * basePx;
  if (value.endsWith("%")) return (parseFloat(value) / 100) * basePx;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : (fallbackPx ?? basePx);
};

const normalizeVerticalSource = (text) => {
  return (text || "")
    .replace(/\u200b/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n|\r/g, "\n");
};

const getFontString = (fontParts, sizePx) => {
  return `${fontParts.style} ${fontParts.variant} ${fontParts.weight} ${sizePx}px ${fontParts.family}`;
};

const isSidewaysRunChar = (ch, pattern = DEFAULT_SIDEWAYS_RUN_RE) => pattern.test(ch);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeLayoutOptions = (optionsOrStyleRanges) => {
  if (Array.isArray(optionsOrStyleRanges)) return { styleRanges: optionsOrStyleRanges };
  return optionsOrStyleRanges || {};
};

const resolveExtraTopOffset = (el, fontSize, options) => {
  const value = options.extraTopOffset ?? options.extraTopOffsetPx ?? 0;
  if (typeof value === "function") return Number(value(el, fontSize)) || 0;
  if (typeof value === "string" && value.endsWith("em")) return parseFloat(value) * fontSize;
  return Number(value) || 0;
};

const emptyTextStyle = Object.freeze({
  fontDelta: 0,
  bold: false,
  underline: null,
  color: null,
});

const resolveTextStyle = (index, styleRanges = [], options = {}) => {
  const style = { ...emptyTextStyle };
  for (const range of styleRanges) {
    if (!range || index < range.start || index >= range.end) continue;
    if (Number.isFinite(range.fontDelta)) style.fontDelta += range.fontDelta;
    if (typeof range.bold === "boolean") style.bold = range.bold;
    if (Object.prototype.hasOwnProperty.call(range, "underline")) {
      style.underline = range.underline || null;
    }
    if (range.color) style.color = range.color;
  }
  style.fontDelta = clamp(
    style.fontDelta,
    options.minFontDelta ?? DEFAULT_OPTIONS.minFontDelta,
    options.maxFontDelta ?? DEFAULT_OPTIONS.maxFontDelta
  );
  return style;
};

const isSameTextStyle = (a, b) => {
  return (
    a.fontDelta === b.fontDelta &&
    a.bold === b.bold &&
    a.underline === b.underline &&
    a.color === b.color
  );
};

const getStyledFontParts = (fontParts, style) => ({
  ...fontParts,
  weight: style.bold ? "700" : fontParts.weight,
});

const measureFontAscent = (ctx, fontParts, fontSize) => {
  ctx.save();
  ctx.font = getFontString(fontParts, fontSize);
  const ascent = ctx.measureText("用").actualBoundingBoxAscent || 0.88 * fontSize;
  ctx.restore();
  return ascent;
};

const getElementText = (el) => {
  const textareas = Array.from(el.querySelectorAll("textarea"));
  if (textareas.length) {
    return textareas.map((ta) => ta.value || ta.textContent || "").join("\n");
  }

  const inputs = Array.from(el.querySelectorAll('input[type="text"],input:not([type])'));
  if (inputs.length) return inputs.map((input) => input.value || "").join("\n");

  return el.innerText || el.textContent || "";
};

const parseFontParts = (cs) => {
  const sizePx = getPxValue(cs.fontSize, 16, 16);
  return {
    style: cs.fontStyle || "normal",
    variant: cs.fontVariant || "normal",
    weight: cs.fontWeight || "400",
    family: cs.fontFamily || "sans-serif",
    sizePx,
  };
};

const drawVerticalUnderline = (ctx, item, scale = 1, originX = 0, originY = 0) => {
  const underline = item.style && item.style.underline;
  if (!underline) return;

  const x = originX + (item.x + item.fontSize * 0.56) * scale;
  const y1 = originY + (item.top + 2) * scale;
  const y2 = originY + (item.bottom - 2) * scale;
  const lineGap = Math.max(2, item.fontSize * 0.12) * scale;

  ctx.save();
  ctx.strokeStyle = item.style.color || item.color || "#000";
  ctx.lineCap = "round";
  ctx.lineWidth = underline === "thick" ? Math.max(2, 2.3 * scale) : Math.max(1, 1.25 * scale);

  const strokeLine = (offset = 0) => {
    ctx.beginPath();
    ctx.moveTo(x + offset, y1);
    ctx.lineTo(x + offset, y2);
    ctx.stroke();
  };

  if (underline === "double") {
    strokeLine(-lineGap * 0.5);
    strokeLine(lineGap * 0.5);
  } else if (underline === "dotted") {
    ctx.setLineDash([Math.max(1, 1.2 * scale), Math.max(2, 3.2 * scale)]);
    strokeLine();
  } else if (underline === "dashed") {
    ctx.setLineDash([Math.max(4, 6 * scale), Math.max(3, 4 * scale)]);
    strokeLine();
  } else if (underline === "dashdot") {
    ctx.setLineDash([
      Math.max(5, 7 * scale),
      Math.max(2, 3 * scale),
      Math.max(1, 1.4 * scale),
      Math.max(2, 3 * scale),
    ]);
    strokeLine();
  } else if (underline === "wavy") {
    const amp = Math.max(1.2, 1.8 * scale);
    const step = Math.max(3, 4 * scale);
    ctx.beginPath();
    for (let y = y1; y <= y2; y += step) {
      const waveX = x + Math.sin(((y - y1) / step) * Math.PI) * amp;
      if (y === y1) ctx.moveTo(waveX, y);
      else ctx.lineTo(waveX, y);
    }
    ctx.stroke();
  } else {
    strokeLine();
  }

  ctx.restore();
};

/**
 * Build a deterministic vertical-rl layout from an element and text.
 *
 * @param {HTMLElement} el vertical container
 * @param {string} text source text
 * @param {object|Array} optionsOrStyleRanges layout options or style ranges
 * @returns {object} layout data with visibleText and drawable items
 */
export function getVerticalTextLayout(el, text, optionsOrStyleRanges = {}) {
  const options = normalizeLayoutOptions(optionsOrStyleRanges);
  const styleRanges = options.styleRanges || [];

  if (!el) {
    return {
      visibleText: text || "",
      items: [],
      contentX: 0,
      contentY: 0,
      contentW: 0,
      contentH: 0,
      fontParts: { style: "normal", variant: "normal", weight: "400", family: "sans-serif", sizePx: 16 },
    };
  }

  const cs = getComputedStyle(el);
  const fontParts = parseFontParts(cs);
  const fontSize = fontParts.sizePx;
  const lineHeight = getPxValue(cs.lineHeight, fontSize, fontSize);
  const letterSpacing = cs.letterSpacing === "normal" ? 0 : getPxValue(cs.letterSpacing, fontSize, 0);
  const padding = {
    t: getPxValue(cs.paddingTop, fontSize, 0),
    r: getPxValue(cs.paddingRight, fontSize, 0),
    b: getPxValue(cs.paddingBottom, fontSize, 0),
    l: getPxValue(cs.paddingLeft, fontSize, 0),
  };

  const contentW = Math.max(0, (el.offsetWidth || el.getBoundingClientRect().width) - padding.l - padding.r);
  const extraTopOffset = resolveExtraTopOffset(el, fontSize, options);
  const contentH = Math.max(
    0,
    (el.offsetHeight || el.getBoundingClientRect().height) - padding.t - padding.b - extraTopOffset
  );
  const contentX = padding.l;
  const contentY = padding.t + extraTopOffset;

  if (!contentW || !contentH) {
    return { visibleText: "", items: [], contentX, contentY, contentW, contentH, fontParts };
  }

  const ctx = getMeasureContext();
  ctx.font = getFontString(fontParts, fontSize);

  const colAdvance = Math.max(1, lineHeight);
  const rowAdvance = Math.max(1, fontSize + letterSpacing);
  const ascent = ctx.measureText("用").actualBoundingBoxAscent || 0.88 * fontSize;
  const contentBottom = contentY + contentH;

  let xCenter = contentX + contentW - colAdvance * 0.5;
  let baselineY = contentY + ascent;
  let visible = "";
  let sourceIndex = 0;
  const items = [];

  const nextColumn = () => {
    xCenter -= colAdvance;
    baselineY = contentY + ascent;
  };

  const measureSidewaysRun = (run, textStyle) => {
    const styledFontSize = Math.max(options.minFontSize ?? DEFAULT_OPTIONS.minFontSize, fontSize + textStyle.fontDelta);
    const styledFontParts = getStyledFontParts(fontParts, textStyle);
    const styledRowAdvance = Math.max(1, styledFontSize + letterSpacing);

    if (/^ +$/.test(run)) {
      return {
        runFontSize: styledFontSize,
        runFontParts: styledFontParts,
        runWidth: styledRowAdvance * run.length,
        runAdvance: styledRowAdvance * run.length,
        runAscent: ascent,
      };
    }

    const compactNumeric = /^[([]?\d{2,6}[)\]]?$/.test(run);
    const runFontSize = compactNumeric ? styledFontSize * (options.sidewayNumericRatio ?? DEFAULT_OPTIONS.sidewayNumericRatio) : styledFontSize;
    ctx.save();
    ctx.font = getFontString(styledFontParts, runFontSize);
    const runWidth = ctx.measureText(run).width + Math.max(0, run.length - 1) * letterSpacing;
    const runAscent = ctx.measureText("用").actualBoundingBoxAscent || 0.88 * runFontSize;
    ctx.restore();

    return {
      runFontSize,
      runFontParts: styledFontParts,
      runWidth,
      runAdvance: Math.max(styledRowAdvance, runWidth),
      runAscent,
    };
  };

  const sidewaysPattern = options.sidewaysRunCharPattern || DEFAULT_SIDEWAYS_RUN_RE;
  const source = normalizeVerticalSource(text);
  const paragraphs = source.split("\n");

  for (let p = 0; p < paragraphs.length; p++) {
    const chars = Array.from(paragraphs[p]);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const textStyle = resolveTextStyle(sourceIndex, styleRanges, options);

      if (isSidewaysRunChar(ch, sidewaysPattern)) {
        let run = ch;
        while (i + 1 < chars.length && isSidewaysRunChar(chars[i + 1], sidewaysPattern)) {
          const nextStyle = resolveTextStyle(sourceIndex + run.length, styleRanges, options);
          if (!isSameTextStyle(textStyle, nextStyle)) break;
          run += chars[++i];
        }

        const { runFontSize, runFontParts, runWidth, runAdvance, runAscent } = measureSidewaysRun(run, textStyle);
        if (baselineY + runAdvance - runAscent > contentBottom) {
          nextColumn();
          if (xCenter < contentX) {
            return { visibleText: visible, items, contentX, contentY, contentW, contentH, fontParts, colAdvance, rowAdvance, ascent };
          }
        }

        visible += run;
        if (!/^ +$/.test(run)) {
          items.push({
            type: "sideways",
            text: run,
            start: sourceIndex,
            end: sourceIndex + run.length,
            x: xCenter,
            y: baselineY - runAscent + runWidth * 0.5,
            top: baselineY - runAscent,
            bottom: baselineY - runAscent + runAdvance,
            advance: runAdvance,
            fontSize: runFontSize,
            fontParts: runFontParts,
            style: textStyle,
            color: cs.color || "#000",
          });
        }
        sourceIndex += run.length;
        baselineY += runAdvance;
        continue;
      }

      const itemFontSize = Math.max(options.minFontSize ?? DEFAULT_OPTIONS.minFontSize, fontSize + textStyle.fontDelta);
      const itemFontParts = getStyledFontParts(fontParts, textStyle);
      const itemAscent = measureFontAscent(ctx, itemFontParts, itemFontSize);
      const itemAdvance = Math.max(1, itemFontSize + letterSpacing);

      if (baselineY + (itemAdvance - itemAscent) > contentBottom) {
        nextColumn();
        if (xCenter < contentX) {
          return { visibleText: visible, items, contentX, contentY, contentW, contentH, fontParts, colAdvance, rowAdvance, ascent };
        }
      }

      visible += ch;
      items.push({
        type: "upright",
        text: ch,
        start: sourceIndex,
        end: sourceIndex + ch.length,
        x: xCenter,
        y: baselineY,
        top: baselineY - itemAscent,
        bottom: baselineY - itemAscent + itemAdvance,
        advance: itemAdvance,
        fontSize: itemFontSize,
        fontParts: itemFontParts,
        style: textStyle,
        color: cs.color || "#000",
      });
      sourceIndex += ch.length;
      baselineY += itemAdvance;
    }

    if (p < paragraphs.length - 1) {
      visible += "\n";
      sourceIndex += 1;
      nextColumn();
      if (xCenter < contentX) {
        return { visibleText: visible, items, contentX, contentY, contentW, contentH, fontParts, colAdvance, rowAdvance, ascent };
      }
    }
  }

  return { visibleText: visible, items, contentX, contentY, contentW, contentH, fontParts, colAdvance, rowAdvance, ascent };
}

export function getVisibleVerticalText(el, text, options = {}) {
  return getVerticalTextLayout(el, text, options).visibleText;
}

const getCaretRectFromLayout = (layout, index) => {
  const { items, contentX, contentY, contentW, colAdvance = 16, ascent = 12 } = layout;
  const caretHeight = Math.max(10, colAdvance * 0.68);

  if (!items.length) {
    return {
      x: contentX + contentW - colAdvance * 0.5,
      y: contentY + ascent,
      width: Math.max(1, colAdvance * 0.72),
      height: 2,
    };
  }

  const first = items[0];
  if (index <= first.start) return { x: first.x, y: first.top, width: caretHeight, height: 2 };

  for (const item of items) {
    if (index <= item.end) {
      const span = Math.max(1, item.end - item.start);
      const ratio = index <= item.start ? 0 : Math.min(1, (index - item.start) / span);
      return {
        x: item.x,
        y: item.top + item.advance * ratio,
        width: caretHeight,
        height: 2,
      };
    }
  }

  const last = items[items.length - 1];
  return { x: last.x, y: last.bottom, width: caretHeight, height: 2 };
};

export function getVerticalTextIndexFromPoint(el, text, clientX, clientY, options = {}) {
  const layout = getVerticalTextLayout(el, text, options);
  const rect = el.getBoundingClientRect();
  const scaleX = rect.width / (el.offsetWidth || rect.width || 1);
  const scaleY = rect.height / (el.offsetHeight || rect.height || 1);
  const x = (clientX - rect.left) / (scaleX || 1);
  const y = (clientY - rect.top) / (scaleY || 1);

  if (!layout.items.length) return 0;

  const columnX = layout.items.reduce((best, item) => {
    return Math.abs(item.x - x) < Math.abs(best - x) ? item.x : best;
  }, layout.items[0].x);
  const columnItems = layout.items.filter((item) => Math.abs(item.x - columnX) < 0.5);
  const first = columnItems[0];
  const last = columnItems[columnItems.length - 1];

  if (y <= first.top) return first.start;
  for (const item of columnItems) {
    if (y <= item.bottom) {
      if (item.type === "sideways" && item.end > item.start + 1) {
        const ratio = Math.max(0, Math.min(1, (y - item.top) / item.advance));
        return item.start + Math.round((item.end - item.start) * ratio);
      }
      const middle = item.top + item.advance * 0.5;
      return y < middle ? item.start : item.end;
    }
  }

  return last.end;
}

const drawLayoutItems = (ctx, layout, drawOptions = {}) => {
  const scale = drawOptions.scale || 1;
  const originX = drawOptions.originX || 0;
  const originY = drawOptions.originY || 0;
  const baseColor = drawOptions.color || "#000";

  for (const item of layout.items) {
    ctx.font = getFontString(item.fontParts || layout.fontParts, item.fontSize * scale);
    ctx.fillStyle = item.style.color || baseColor;

    if (item.type === "sideways") {
      ctx.save();
      ctx.translate(originX + item.x * scale, originY + item.y * scale);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.text, 0, 0);
      ctx.restore();
    } else {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(item.text, originX + item.x * scale, originY + item.y * scale);
    }

    drawVerticalUnderline(ctx, item, scale, originX, origin);
  }
};

/**
 * Paint a vertical text preview canvas with optional selection and caret.
 */
export function paintVisibleVerticalText(canvas, el, text, options = {}) {
  if (!canvas || !el) return;

  const dpr = options.pixelRatio || window.devicePixelRatio || 1;
  const width = el.clientWidth || el.offsetWidth || 1;
  const height = el.clientHeight || el.offsetHeight || 1;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.writingMode = "horizontal-tb";
  canvas.style.textOrientation = "mixed";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const cs = getComputedStyle(el);
  const layout = getVerticalTextLayout(el, text || "", options);
  if (!layout.contentW || !layout.contentH) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.contentX, layout.contentY, layout.contentW, layout.contentH);
  ctx.clip();

  const selectionStart = Number.isFinite(options.selectionStart) ? options.selectionStart : null;
  const selectionEnd = Number.isFinite(options.selectionEnd) ? options.selectionEnd : null;
  if (selectionStart !== null && selectionEnd !== null) {
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);

    if (end > start) {
      ctx.fillStyle = options.selectionColor || "rgba(0, 95, 213, 0.36)";
      for (const item of layout.items) {
        if (item.end <= start || item.start >= end) continue;
        const rectW = Math.max(8, (layout.colAdvance || item.fontSize) * 0.92);
        ctx.fillRect(item.x - rectW * 0.5, item.top, rectW, item.advance);
      }
    } else if (options.showCaret) {
      const caret = getCaretRectFromLayout(layout, start);
      ctx.fillStyle = options.caretColor || "#000";
      ctx.fillRect(caret.x - caret.width * 0.5, caret.y - caret.height * 0.5, caret.width, caret.height);
    }
  }

  drawLayoutItems(ctx, layout, { color: cs.color || "#000" });
  ctx.restore();
}

const getOffsetPage = (el) => {
  let x = 0;
  let y = 0;
  let node = el;
  while (node) {
    x += node.offsetLeft || 0;
    y += node.offsetTop || 0;
    node = node.offsetParent;
  }
  return { x, y };
};

const getLayoutBox = (el, rootOffset) => {
  const elOffset = getOffsetPage(el);
  const rect = el.getBoundingClientRect();
  return {
    x: elOffset.x - rootOffset.x,
    y: elOffset.y - rootOffset.y,
    w: el.offsetWidth || rect.width,
    h: el.offsetHeight || rect.height,
  };
};

const isVerticalElement = (el) => {
  const writingMode = getComputedStyle(el).writingMode || "";
  return writingMode.includes("vertical-rl");
};

const collectVerticalElements = (root, options) => {
  const selector = options.verticalSelector || "*";
  const all = [];
  if (root instanceof Element && root.matches(selector) && isVerticalElement(root)) all.push(root);
  all.push(...Array.from(root.querySelectorAll(selector)).filter(isVerticalElement));

  return all.filter((el) => {
    if (typeof options.shouldHandleElement === "function" && !options.shouldHandleElement(el)) return false;

    let parent = el.parentElement;
    while (parent && parent !== root) {
      if (all.includes(parent)) return false;
      parent = parent.parentElement;
    }
    return true;
  });
};

const getHtml2Canvas = (options) => {
  const fn = options.html2canvas || globalThis.html2canvas;
  if (typeof fn !== "function") {
    throw new Error("h2c-vertical-typesetter requires html2canvas. Pass { html2canvas } or load it globally.");
  }
  return fn;
};

/**
 * Capture a DOM root with deterministic vertical-rl text rendering.
 *
 * @param {HTMLElement} root DOM root passed to html2canvas
 * @param {object} options html2canvas options plus vertical typesetter options
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function captureWithVerticalTypeset(root, options = {}) {
  if (!root) throw new Error("captureWithVerticalTypeset(root): root is required.");

  const html2canvas = getHtml2Canvas(options);
  const verticalEls = collectVerticalElements(root, options);
  if (!verticalEls.length) return html2canvas(root, options);

  const rootRect = root.getBoundingClientRect();
  const rootLayoutW = root.offsetWidth || rootRect.width;
  const rootLayoutH = root.offsetHeight || rootRect.height;
  const rootOffset = getOffsetPage(root);

  const verticalNodes = verticalEls.map((el, idx) => {
    const cs = getComputedStyle(el);
    const rawText = normalizeVerticalSource(getElementText(el));
    const styleRanges =
      (typeof options.styleRangesResolver === "function" && options.styleRangesResolver(el)) ||
      el.__h2cVerticalStyleRanges ||
      el.__verticalTextStyleRanges ||
      [];
    const layout = getVerticalTextLayout(el, rawText, { ...options, styleRanges });
    const layoutBox = getLayoutBox(el, rootOffset);
    const id = `h2c-vrl-${Date.now().toString(36)}-${idx}`;
    el.setAttribute("data-h2c-vrl-id", id);

    return {
      id,
      el,
      layout,
      layoutBox,
      color: cs.color || "#000",
    };
  });

  const userOnclone = options.onclone;
  const onclone = (doc, clonedRoot) => {
    if (typeof userOnclone === "function") userOnclone(doc, clonedRoot);

    const style = doc.createElement("style");
    style.textContent = `
      [data-h2c-vrl-id],
      [data-h2c-vrl-id] *,
      [data-h2c-vrl-id] textarea,
      [data-h2c-vrl-id] input {
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: none !important;
        caret-color: transparent !important;
      }
    `;
    doc.head.appendChild(style);

    clonedRoot.querySelectorAll("textarea").forEach((ta) => {
      const win = doc.defaultView;
      const cs = win.getComputedStyle(ta);
      const div = doc.createElement("div");
      div.style.cssText = cs.cssText || "";
      div.style.border = "none";
      div.style.background = "transparent";
      div.style.outline = "none";
      div.style.resize = "none";
      div.style.overflow = "hidden";
      div.style.whiteSpace = "pre-wrap";
      ta.parentNode.replaceChild(div, ta);
    });

    clonedRoot.querySelectorAll('input[type="text"],input:not([type])').forEach((input) => {
      const win = doc.defaultView;
      const cs = win.getComputedStyle(input);
      const div = doc.createElement("div");
      div.style.cssText = cs.cssText || "";
      div.style.border = "none";
      div.style.background = "transparent";
      div.style.outline = "none";
      div.style.overflow = "hidden";
      div.style.whiteSpace = "nowrap";
      div.style.display = cs.display === "inline" ? "inline-block" : cs.display;
      input.parentNode.replaceChild(div, input);
    });
  };

  const userIgnoreElements = options.ignoreElements;
  const previewIgnoreSelector = options.previewIgnoreSelector ?? DEFAULT_OPTIONS.previewIgnoreSelector;
  const baseCanvas = await html2canvas(root, {
    backgroundColor: options.backgroundColor ?? DEFAULT_OPTIONS.defaultBackgroundColor,
    ...options,
    ignoreElements: (el) => {
      if (typeof userIgnoreElements === "function" && userIgnoreElements(el)) return true;
      if (previewIgnoreSelector && el.matches && el.matches(previewIgnoreSelector)) return true;
      const tag = (el.tagName || "").toUpperCase();
      return tag === "TEXTAREA" || (tag === "INPUT" && ((el.type || "text").toLowerCase() === "text"));
    },
    onclon,
  });

  const ctx = baseCanvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const scaleX = baseCanvas.width / rootLayoutW;
  const scaleY = baseCanvas.height / rootLayoutH;
  const scale = Math.abs(scaleX - scaleY) < 1e-3 ? scaleX : scaleX;

  for (const node of verticalNodes) {
    const { layoutBox, layout, color } = node;
    const boxX = layoutBox.x * scale;
    const boxY = layoutBox.y * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      boxX + layout.contentX * scale,
      boxY + layout.contentY * scale,
      layout.contentW * scale,
      layout.contentH * scale
    );
    ctx.clip();
    drawLayoutItems(ctx, layout, { scale, originX: boxX, originY: boxY, color });
    ctx.restore();
    node.el.removeAttribute("data-h2c-vrl-id");
  }

  return baseCanvas;
}

export default {
  captureWithVerticalTypeset,
  getVerticalTextIndexFromPoint,
  getVerticalTextLayout,
  getVisibleVerticalText,
  paintVisibleVerticalText,
}
