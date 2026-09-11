// Coordinates are viewport fractions; no gameplay data is needed for rendering.
export function renderMemoOperations(context, operations, width, height) {
  context.clearRect(0, 0, width, height);
  for (const operation of operations) {
    if (operation.kind === "clear") { context.clearRect(0, 0, width, height); continue; }
    context.globalCompositeOperation = operation.tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = "#a62965";
    context.fillStyle = "#a62965";
    context.lineWidth = operation.width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    const [x, y] = operation.points[0];
    if (operation.points.length === 1) {
      context.arc(x * width, y * height, operation.width / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.moveTo(x * width, y * height);
      for (const point of operation.points.slice(1)) context.lineTo(point[0] * width, point[1] * height);
      context.stroke();
    }
  }
  context.globalCompositeOperation = "source-over";
}

export function createMemoCanvas({ canvas, getOperations, onStroke, onFailure }) {
  const view = canvas.ownerDocument.defaultView;
  let context;
  let failed = false;
  let enabled = false;
  let tool = "pen";
  let pointerId = null;
  let stroke = null;
  let frame = 0;
  let cssWidth = 0;
  let cssHeight = 0;
  function fail() {
    if (failed) return;
    failed = true;
    enabled = false;
    pointerId = null;
    stroke = null;
    canvas.style.pointerEvents = "none";
    onFailure();
  }
  try { context = canvas.getContext("2d"); } catch { /* handled below */ }
  function redraw() {
    if (!context || failed) return;
    try {
      const rect = canvas.getBoundingClientRect();
      cssWidth = rect.width; cssHeight = rect.height;
      if (cssWidth < 1 || cssHeight < 1) return;
      const ratio = Math.max(1, Math.min(3, view.devicePixelRatio || 1));
      const pixelWidth = Math.ceil(cssWidth * ratio), pixelHeight = Math.ceil(cssHeight * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const operations = stroke ? [...getOperations(), stroke] : getOperations();
      renderMemoOperations(context, operations, cssWidth, cssHeight);
    } catch { fail(); }
  }
  function scheduleDraw() {
    if (!frame) frame = view.requestAnimationFrame(() => { frame = 0; redraw(); });
  }
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)))];
  }
  function finish() {
    if (pointerId === null) return;
    const releasedId = pointerId;
    const completed = stroke;
    pointerId = null; stroke = null;
    try { if (canvas.hasPointerCapture(releasedId)) canvas.releasePointerCapture(releasedId); } catch { /* detached pointer */ }
    if (completed?.points.length) onStroke(completed);
    scheduleDraw();
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (!enabled || failed || pointerId !== null || event.button !== 0) return;
    event.preventDefault();
    pointerId = event.pointerId;
    stroke = { kind: "stroke", tool, width: tool === "pen" ? 3 : 20, points: [point(event)] };
    try { canvas.setPointerCapture(pointerId); } catch { finish(); }
    scheduleDraw();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!enabled || event.pointerId !== pointerId || !stroke) return;
    event.preventDefault();
    const events = event.getCoalescedEvents?.();
    for (const sample of events?.length ? events : [event]) {
      if (stroke.points.length >= 12000) break;
      const next = point(sample), previous = stroke.points.at(-1);
      if (Math.hypot((next[0] - previous[0]) * cssWidth, (next[1] - previous[1]) * cssHeight) >= 0.5) stroke.points.push(next);
    }
    scheduleDraw();
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(eventName, (event) => { if (event.pointerId === pointerId) finish(); });
  }
  view.addEventListener("resize", scheduleDraw);
  view.visualViewport?.addEventListener("resize", scheduleDraw);
  view.addEventListener("blur", finish);
  if (!context) fail();
  return {
    get available() { return !failed; },
    redraw,
    finish,
    setTool(value) { finish(); tool = value === "eraser" ? "eraser" : "pen"; },
    setEnabled(value) { if (!value) finish(); enabled = Boolean(value) && !failed; },
  };
}
