// Prints an HTML document without opening a new tab/window. `window.open()`
// is subject to the browser's popup blocker, which is often far more
// aggressive on a real deployed domain than it is on localhost during dev —
// leading to it silently returning null and nothing visibly happening. A
// hidden iframe on the current page is never treated as a popup, so this
// works the same way in every environment.

export function printHtmlDocument(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const removeIframe = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    removeIframe();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    removeIframe();
    return;
  }

  const triggerPrint = () => {
    win.focus();
    // Clean up once the print dialog closes (or is cancelled). Not all
    // browsers fire `afterprint` reliably on an iframe's window, so also
    // fall back to a generous timeout as a safety net.
    win.onafterprint = removeIframe;
    setTimeout(removeIframe, 60000);
    win.print();
  };

  // Give the iframe a beat to finish loading (styles included) before
  // printing, whether or not the load event has already fired.
  if (doc.readyState === "complete") {
    setTimeout(triggerPrint, 250);
  } else {
    iframe.onload = () => setTimeout(triggerPrint, 250);
  }
}
