import { useRef, useState } from "react";
import { GetData } from "../services/api.service.js"; // curly braces since no default export in file

const pdfjsLib = window.pdfjsLib;
const pdfjsViewer = window.pdfjsViewer;

let containerStyle = {
  overflow: "auto",
  position: "absolute",
  width: "100%",
  height: "100%",
};

function Viewer() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

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

  const loadPdf = async () => {
    const resp = await GetData("http://localhost:8000/pdf/");
    renderInitialPdf(resp);
  };

  const handlePageInit = (
    eventBus,
    pdfViewer,
    pdfFindController,
    SEARCH_FOR
  ) => {
    eventBus.on("pagesinit", function () {
      // We can use pdfViewer now, e.g. let's change default scale.
      pdfViewer.currentScaleValue = "page-width";
      // We can try searching for things.
      if (SEARCH_FOR) {
        pdfFindController.executeCommand("find", { query: SEARCH_FOR });
      }
    });
  };

  const handleDocLoad = async (loadingTask, pdfViewer, pdfLinkService) => {
    const pdfDocument = await loadingTask.promise;
    // Document loaded, specifying document for the viewer and
    // the (optional) linkService.
    pdfViewer.setDocument(pdfDocument);
    pdfLinkService.setDocument(pdfDocument, null);
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

    handlePageInit(eventBus, pdfViewer, pdfFindController, SEARCH_FOR);
    // Loading document.
    const loadingTask = pdfjsLib.getDocument({
      data: rawPDFUrl.data,
      cMapUrl: CMAP_URL,
      cMapPacked: CMAP_PACKED,
    });
    handleDocLoad(loadingTask, pdfViewer, pdfLinkService);
  };

  return (
    <div>
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

export default Viewer;
