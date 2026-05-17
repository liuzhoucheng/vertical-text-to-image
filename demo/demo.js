const {
  captureWithVerticalTypeset,
  getVerticalTextIndexFromPoint,
  paintVisibleVerticalText,
} = window.H2CVerticalTypesetter;

const sourceText = document.querySelector("#sourceText");
const verticalTextarea = document.querySelector("#verticalTextarea");
const verticalBox = document.querySelector("#verticalBox");
const previewCanvas = document.querySelector("#previewCanvas");
const captureButton = document.querySelector("#captureButton");
const styleButton = document.querySelector("#styleButton");
const clearButton = document.querySelector("#clearButton");

let styleRanges = [];
let selecting = false;
let selectionAnchor = 0;

verticalBox.__h2cVerticalStyleRanges = styleRanges;

const syncSourceToVertical = () => {
  verticalTextarea.value = sourceText.value.replace(/ /g, "\u3000");
  paint();
};

const paint = () => {
  paintVisibleVerticalText(previewCanvas, verticalBox, verticalTextarea.value, {
    styleRanges,
    selectionStart: verticalTextarea.selectionStart,
    selectionEnd: verticalTextarea.selectionEnd,
    showCaret: document.activeElement === verticalTextarea && verticalTextarea.selectionStart === verticalTextarea.selectionEnd,
  });
};

const setSelectionByPoint = (event, extend) => {
  const index = getVerticalTextIndexFromPoint(verticalBox, verticalTextarea.value, event.clientX, event.clientY, {
    styleRanges,
  });
  if (extend) {
    verticalTextarea.setSelectionRange(Math.min(selectionAnchor, index), Math.max(selectionAnchor, index));
  } else {
    selectionAnchor = index;
    verticalTextarea.setSelectionRange(index, index);
  }
  paint();
};

verticalTextarea.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  verticalTextarea.focus({ preventScroll: true });
  selecting = true;
  setSelectionByPoint(event, event.shiftKey);
  verticalTextarea.setPointerCapture(event.pointerId);
});

verticalTextarea.addEventListener("pointermove", (event) => {
  if (!selecting) return;
  event.preventDefault();
  setSelectionByPoint(event, true);
});

verticalTextarea.addEventListener("pointerup", (event) => {
  selecting = false;
  try {
    verticalTextarea.releasePointerCapture(event.pointerId);
  } catch (_) {
    // Pointer capture may have already been released.
  }
  paint();
});

verticalTextarea.addEventListener("input", () => {
  sourceText.value = verticalTextarea.value.replace(/\u3000/g, " ");
  paint();
});
verticalTextarea.addEventListener("select", paint);
verticalTextarea.addEventListener("keyup", paint);
verticalTextarea.addEventListener("focus", paint);
verticalTextarea.addEventListener("blur", paint);
sourceText.addEventListener("input", syncSourceToVertical);
window.addEventListener("resize", paint);

styleButton.addEventListener("click", () => {
  styleRanges = [
    { start: 12, end: 20, fontDelta: 2 },
    { start: 12, end: 20, bold: true },
    { start: 12, end: 20, underline: "double" },
    { start: 28, end: 34, underline: "dotted" },
  ];
  verticalBox.__h2cVerticalStyleRanges = styleRanges;
  paint();
});

clearButton.addEventListener("click", () => {
  styleRanges = [];
  verticalBox.__h2cVerticalStyleRanges = styleRanges;
  paint();
});

captureButton.addEventListener("click", async () => {
  captureButton.disabled = true;
  captureButton.textContent = "Rendering...";
  try {
    const canvas = await captureWithVerticalTypeset(document.querySelector("#paper"), {
      html2canvas: window.html2canvas,
      backgroundColor: "#fff",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = "vertical-capture-demo.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  } finally {
    captureButton.disabled = false;
    captureButton.textContent = "Download PNG";
  }
});

syncSourceToVertical();
