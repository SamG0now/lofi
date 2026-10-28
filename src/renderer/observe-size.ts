/** Calls back whenever any of the elements changes size, returns how to stop. */
export const observeSize = (elements: Element[], onResize: () => void): (() => void) => {
  // elements in the settings window are observed from there, the main window's observer wouldn't see them change
  const view = (elements[0].ownerDocument.defaultView ?? window) as typeof window;
  const observer = new view.ResizeObserver(onResize);
  elements.forEach((element) => observer.observe(element));
  return () => observer.disconnect();
};
