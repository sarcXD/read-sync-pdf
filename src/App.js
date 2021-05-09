import { useRef, useState } from "react";
import "./App.css";
const pdfjsLib = window.pdfjsLib;
const pdfjsViewer = window.pdfjsViewer;

// The workerSrc property shall be specified.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.8.335/pdf.worker.min.js";

// Some PDFs need external cmaps.
//
const CMAP_URL = "../../node_modules/pdfjs-dist/cmaps/";
const CMAP_PACKED = true;

// sandbox link
const SANDBOX_BUNDLE_SRC =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.8.335/pdf.sandbox.min.js";

// Example POST method implementation:
async function getData(url = "", data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: "GET", // *GET, POST, PUT, DELETE, etc.
    mode: "cors", // no-cors, *cors, same-origin
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    credentials: "same-origin", // include, *same-origin, omit
    headers: {
      "Content-Type": "application/json",
    },
    redirect: "follow", // manual, *follow, error
    referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

let containerStyle = {
  overflow: "auto",
  position: "absolute",
  width: "100%",
  height: "100%",
};

function App() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [textX, setTextX] = useState(0);
  const [textY, setTextY] = useState(0);

  const loadPdf = async () => {
    const resp = await getData("http://localhost:8000/pdf/");
    console.log(resp);
    renderInitialPdf(resp);
  };

  const renderInitialPdf = (rawPDFUrl) => {
    if (containerRef == null || containerRef.current == null) {
      return;
    }
    const SEARCH_FOR = "starters"; // try 'Mozilla';

    const container = containerRef.current;

    const eventBus = new pdfjsViewer.EventBus();

    // (Optionally) enable hyperlinks within PDF files.
    const pdfLinkService = new pdfjsViewer.PDFLinkService({
      eventBus,
    });

    // (Optionally) enable find controller.
    const pdfFindController = new pdfjsViewer.PDFFindController({
      eventBus,
      linkService: pdfLinkService,
    });

    // (Optionally) enable scripting support.
    const pdfScriptingManager = new pdfjsViewer.PDFScriptingManager({
      eventBus,
      sandboxBundleSrc: SANDBOX_BUNDLE_SRC,
    });

    const pdfViewer = new pdfjsViewer.PDFViewer({
      container,
      eventBus,
      linkService: pdfLinkService,
      findController: pdfFindController,
      scriptingManager: pdfScriptingManager,
      enableScripting: true,
    });

    pdfLinkService.setViewer(pdfViewer);
    pdfScriptingManager.setViewer(pdfViewer);

    eventBus.on("pagesinit", function () {
      // We can use pdfViewer now, e.g. let's change default scale.
      pdfViewer.currentScaleValue = "page-width";

      // We can try searching for things.
      if (SEARCH_FOR) {
        pdfFindController.executeCommand("find", { query: SEARCH_FOR });
      }
    });

    // Loading document.
    const loadingTask = pdfjsLib.getDocument({
      data: rawPDFUrl.data,
      cMapUrl: CMAP_URL,
      cMapPacked: CMAP_PACKED,
    });
    loadingTask.promise.then(function (pdfDocument) {
      // Document loaded, specifying document for the viewer and
      // the (optional) linkService.
      pdfViewer.setDocument(pdfDocument);

      pdfLinkService.setDocument(pdfDocument, null);
      pdfViewer._currentPageNumber += 5;
      console.log("pagenum", pdfViewer.currentPageNumber);
    });
  };

  return (
    <div className="App">
      <div
        id="#viewerContainer"
        ref={containerRef}
        style={{ ...containerStyle }}
      >
        <div id="#viewer" className="pdfViewer" ref={viewerRef} />
      </div>
      <button onClick={loadPdf} style={{ position: "absolute" }}>
        Load PDF from backend
      </button>
    </div>
  );
}

export default App;
