import { useRef } from "react";
import { GetData } from "../services/api.service.js"; // curly braces since no default export in file

const pdfjsLib = window.pdfjsLib;
const pdfjsViewer = window.pdfjsViewer;

let containerStyle = {
  overflow: "auto",
  position: "absolute",
  width: "100%",
  height: "100%",
};

export const pdfVariables = {
  eventBus: null,
  pdfDocument: null,
  pdfViewer: null,
  pdfLinkService: null,
  pdfFindController: null,
  pdfScriptingManager: null,
}

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
    SEARCH_FOR
  ) => {
    pdfVariables.eventBus.on("pagesinit", function () {
      // We can use pdfViewer now, e.g. let's change default scale.
      pdfVariables.pdfViewer.currentScaleValue = "page-width";
      pdfVariables.pdfViewer.currentPageNumber = 5;
      // We can try searching for things.
      if (SEARCH_FOR) {
        pdfVariables.pdfFindController.executeCommand("find", { query: SEARCH_FOR });
      }
    });
  };

  const handleDocLoad = async (loadingTask) => {
    const pdfDocument = await loadingTask.promise;
    // Document loaded, specifying document for the viewer and
    // the (optional) linkService.
    pdfVariables.pdfViewer.setDocument(pdfDocument);
    pdfVariables.pdfLinkService.setDocument(pdfDocument, null);
    pdfVariables.pdfDocument = pdfDocument;
  };

  const renderInitialPdf = async (rawPDFUrl) => {
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

    pdfVariables.eventBus = eventBus;
    pdfVariables.pdfViewer = pdfViewer;
    pdfVariables.pdfScriptingManager = pdfScriptingManager;
    pdfVariables.pdfLinkService = pdfLinkService;
    pdfVariables.pdfFindController = pdfFindController;
    

    handlePageInit(SEARCH_FOR);
    // Loading document.
    const loadingTask = pdfjsLib.getDocument({
      data: rawPDFUrl.data,
      cMapUrl: CMAP_URL,
      cMapPacked: CMAP_PACKED,
    });
    
    await handleDocLoad(loadingTask);
    console.log(pdfVariables.pdfDocument.numPages);
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
