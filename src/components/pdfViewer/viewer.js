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

function isEmpty(obj) {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}

function Viewer() {
  // specific to pdf.js viewer
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [pdfVariables, setPdfVariables] = useState({});
  const [pgNum, setPgNum] = useState("");
  // specific to app state
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [openFile, setOpenFile] = useState(null);
  const [signedIn, setSignedIn] = useState(false);
  const [pdfState, setPdfState] = useState({});
  let userState = {};
  let pdfPath = "";

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
    const url = await downloadFileFromFB();
    if (url) {
      console.log("rendering url", url);
      renderInitialPdf(url);
    } else {
      alert("Cant download file, Please report");
    }
    // const resp = await PostData('http://localhost:8000/pdf', { dldUrl: url });
    // console.log(resp)
  };

  const createPdfEntry = async () => {
    const pdfDetails = {
      pdfLink: pdfPath,
      email: userState.email,
    };
    const status = await PostData("http://localhost:8000/pdf/new_pdf", {
      pdfDetails: pdfDetails,
    });
    console.log("Pdf Entry Status", status);
  };

  const updatePdfEntry = async () => {
    const pdfDetails = {
      pdfLink: pdfPath,
      email: userState.email,
    };
    const status = await PostData(
      "http://localhost:8000/pdf/update_pdf_entry",
      {
        pdfDetails: pdfDetails,
      }
    );
    console.log("Pdf Update Entry Status", status);
  };

  const createOrUpdateUserRecord = async () => {
    const userDetails = {
      email: userState.email,
      displayName: userState.displayName,
    };
    const status = await PostData("http://localhost:8000/pdf/create_user", {
      userDetails: userDetails,
    });
    console.log("User created status", status);
  };

  const getOpenedPdf = async () => {
    if (userState) {
      /**
       * Fetched State:
       * currPage Page user left reading on
       * pdfLink Path of pdf in fb storage
       */
      const fetchedState = await PostData("http://localhost:8000/pdf/resume", {
        email: userState.email,
      });
      setPdfState(fetchedState);
      console.log("Fetched state", fetchedState);
      let resume = false;
      if (!isEmpty(fetchedState)) {
        resume = true;
        pdfPath = fetchedState?.pdfLink;
      }
      return resume;
    } else {
      console.log("ERROR", "No User State object exists, cant fetch details");
    }
  };

  /**
   * Save user variables
   * uid, email, displayName
   */
   const saveUserState = (user) => {
    userState = {
      id: user?.uid,
      email: user?.email,
      name: user?.displayName,
    };
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
    const SEARCH_FOR = "starters";
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
    setPdfLoaded(true);
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

  const removePreviousPdf = (prevFilePath) => {
    if (prevFilePath) {
      const storageRef = storage.ref();
      const pdfRef = storageRef.child(prevFilePath);
      pdfRef.delete().then(() => {
        console.log("Pdf Deletion", "Pdf deleted successfully");
      });
    } else {
      console.log("No previous pdf path is in memory or db");
    }
  };

  const uploadToFirebaseAndOpen = (file) => {
    if (file) {
      const storageRef = storage.ref();
      const filePath = userState.email + "/" + file.name;
      pdfPath = filePath;
      const pdfRef = storageRef.child(filePath);
      pdfRef.put(file).then((snapshot) => {
        alert("File uploaded successfully");
        loadPdf();
      });
    }
  };

  const downloadFileFromFB = async () => {
    const storageRef = storage.ref();
    const url = await storageRef.child(pdfPath).getDownloadURL();
    return url;
  };

  const uploadAndOpenPdf = async ($ev) => {
    const file = $ev.target.files[0];
    console.log(file);
    return;
    // @mark IMPORTANT
    // At the start and for free versions, user is limited to just 1 pdf
    // If user needs to open new pdf:
    // previous pdf should be deleted
    // Their entry in the backend should be updated
    const updatePdf = pdfPath.length? true: false;
    removePreviousPdf(pdfPath);
    uploadToFirebaseAndOpen(file);
    if (updatePdf) {
      updatePdfEntry();
    } else {
      createPdfEntry();
    }
  };

  const initPdfRendering = async (user) => {
    saveUserState(user);
    setSignedIn(true);
    await createOrUpdateUserRecord();
    const resume = await getOpenedPdf();
    if (resume) loadPdf();
  };

  const signInGoogle = () => {
    const provider = new firebaseRef.auth.GoogleAuthProvider();
    firebaseRef
      .auth()
      .signInWithPopup(provider)
      .then((result) => {
        //@mark shift to using tokens for authentication after alpha build
        //    var credential = result.credential;
        // This gives you a Google Access Token. You can use it to access the Google API.
        //    var token = credential.accessToken;
        // The signed-in user info.
        initPdfRendering(result.user);
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
    firebaseRef
      .auth()
      .signOut()
      .then(() => {
        userState = {};
        setSignedIn(false);
      })
      .catch((error) => {
        // Error occurred
      });
  };

  // Performed when user logs in to the page
  // Performed when user logs out
  const authCheck = () => {
    firebaseRef.auth().onAuthStateChanged(async (user) => {
      if (user) {
        initPdfRendering(user);
      } else {
        setSignedIn(false);
      }
    });
  };

  useEffect(() => {
    console.log("aC");
    authCheck();
    // fetchStateAndLoadPdf()
  }, []);

  return (
    <div>
      {signedIn ? (
        <div
          id="#viewerContainer"
          ref={containerRef}
          style={{ ...containerStyle }}
        >
          <div id="#viewer" className="pdfViewer" ref={viewerRef} />
        </div>
      ) : null}
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
          {pdfLoaded ? (
            <div className="mid-ctn">
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
          ) : null}
          <div className="end-ctn">
            {/* <button>Save</button> */}
            <button onClick={logoutGoogle} className="logout-btn">
              Logout
            </button>
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
