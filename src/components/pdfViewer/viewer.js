import { useRef, useState, useEffect } from "react";
import { PostData } from "../services/api.service.js"; // curly braces since no default export in file
import "./viewer.css";
import { storage, firebaseRef } from "./../../config";

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
  const [pdfVariables, setPdfVariables] = useState({});
  const [pgNum, setPgNum] = useState("");
  const [openFile, setOpenFile] = useState(null);
  const [signedIn, setSignedIn] = useState(false);
  const [userState, setUserState] = useState({});

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
    // const file = await downloadFileFromFB();
    const url = await downloadFileFromFB();
    if (url) {
      // console.log('URL', url);
      // const resp = await PostData('http://localhost:8000/pdf', { dldUrl: url });
      // console.log(resp)
      renderInitialPdf(url);
    }
  };

  const handlePageInit = (SEARCH_FOR, tempStateVar) => {
    tempStateVar.eventBus.on("pagesinit", function () {
      // We can use pdfViewer now, e.g. let's change default scale.

      tempStateVar.pdfViewer.currentScaleValue = "page-width";
      // We can try searching for things.
      if (SEARCH_FOR) {
        tempStateVar.pdfFindController.executeCommand("find", {
          query: SEARCH_FOR,
        });
      }
    });
  };

  const handleDocLoad = async (loadingTask, tempStateVar) => {
    const pdfDocument = await loadingTask.promise;
    // Document loaded, specifying document for the viewer and
    // the (optional) linkService.
    tempStateVar.pdfViewer.setDocument(pdfDocument);
    tempStateVar.pdfLinkService.setDocument(pdfDocument, null);
    tempStateVar.pdfDocument = pdfDocument;
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

    const tempStateVar = {};
    tempStateVar.eventBus = eventBus;
    tempStateVar.pdfViewer = pdfViewer;
    tempStateVar.pdfScriptingManager = pdfScriptingManager;
    tempStateVar.pdfLinkService = pdfLinkService;
    tempStateVar.pdfFindController = pdfFindController;

    handlePageInit(SEARCH_FOR, tempStateVar);
    // Loading document.
    const loadingTask = pdfjsLib.getDocument({
      url: rawPDFUrl,
      cMapUrl: CMAP_URL,
      cMapPacked: CMAP_PACKED,
    });

    await handleDocLoad(loadingTask, tempStateVar);

    // all variables assigned, set tempStateVar to pdfVariables to update UI
    setPdfVariables(tempStateVar);
  };

  const gotoPage = ($ev) => {
    if ($ev.keyCode === 13) {
      $ev.preventDefault();
      pdfVariables.pdfViewer.currentPageNumber = pgNum;
    }
  };

  const setPage = ($ev) => {
    const intVal = parseInt($ev.target.value);
    setPgNum(intVal);
  };

  const uploadToFirebase = (file) => {
    if (file) {
      const storageRef = storage.ref();
      const pdfRef = storageRef.child(file.name);
      pdfRef.put(file).then(() => {
        alert("File uploaded successfully");
      });
    }
  };

  const downloadFileFromFB = async () => {
    const storageRef = storage.ref();
    const refs = await storageRef.listAll();
    const url = await refs.items[0].getDownloadURL();
    return url;
  };

  const uploadAndOpenPdf = ($ev) => {
    const file = $ev.target.files[1];
    setOpenFile(file);
    uploadToFirebase(file);
  };

  const signInGoogle = () => {
    const provider = new firebaseRef.auth.GoogleAuthProvider();
    firebaseRef
      .auth()
      .signInWithPopup(provider)
      .then((result) => {
        var credential = result.credential;
        // This gives you a Google Access Token. You can use it to access the Google API.
        var token = credential.accessToken;
        // The signed-in user info.
        var user = result.user;
        setSignedIn(true);
        // ...
      })
      .catch((error) => {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        // The email of the user's account used.
        var email = error.email;
        // The firebase.auth.AuthCredential type that was used.
        var credential = error.credential;
      });
  };

  const logoutGoogle = () => {
    firebaseRef.auth().signOut().then(() => {
      // saveUserState()
      setSignedIn(false);
    }).catch((error) => {
      // Error occurred
    })
  }

  // Performed when user logs in to the page
  // Performed when user logs out
  const authCheck = () => {
    firebaseRef.auth().onAuthStateChanged((user)=> {
      if (user) {
        const uid = user.uid;
        setSignedIn(true);
      } else {
        setSignedIn(false);
      }
    })
  }

  useEffect(() => {
    authCheck();
    loadPdf();
  }, []);

  return (
    <div>
      <div
        id="#viewerContainer"
        ref={containerRef}
        style={{ ...containerStyle }}
      >
        <div id="#viewer" className="pdfViewer" ref={viewerRef} />
      </div>
      {signedIn ? (
        <div className="toolbar-ctn">
          <div className="start-ctn">
            <input
              className="upload-btn"
              type="file"
              accept=".pdf"
              onChange={uploadAndOpenPdf}
            />
          </div>
          <div className="mid-ctn">
            <button onClick={loadPdf} className="toolbar-btn">
              Load PDF from backend
            </button>
            <input
              type="number"
              value={pgNum}
              onChange={setPage}
              onKeyDown={gotoPage}
              className="toolbar-input"
            />
            <div className="pg-text">of</div>
            <div id="total-pages">{pdfVariables?.pdfDocument?.numPages}</div>
          </div>
          <div className="end-ctn">
            <button>Save</button>
            <button onClick={logoutGoogle} className="logout-btn">Logout</button>
          </div>
        </div>
      ) : (
        <div className="toolbar-ctn">
          <div className="end-ctn">
            <button onClick={signInGoogle} className="sign-in-btn">
              Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Viewer;
