/** Cores resolvidas do CSS, sem duplicar a paleta no adaptador Konva. */
export function canvasTheme() {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(`--${name}`).trim();
  return {
    text: token('text'), muted: token('muted'), accent: token('accent'),
    controlBorder: token('control-border'), canvas: token('canvas'),
    grid: token('canvas-grid'), axis: token('canvas-axis'), wall: token('canvas-wall'),
    sector: token('canvas-sector'), desk: token('canvas-desk'), rack: token('canvas-rack'),
    warning: token('warning'), font: style.fontFamily,
  };
}
