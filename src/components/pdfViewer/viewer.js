import { useRef, useState, useEffect } from "react";
import DarkModeBtn from "../DarkModeBtn/DarkModeBtn.js";
import Dictionary from "../Dictionary/Dictionary.js";
import { PostData } from "../services/api.service.js"; // curly braces since no default export in file
import "./viewer.css";
import { storage, firebaseRef } from "../../configs/fbConfig";
import { configVars } from "../../configs/envConfig";
import { FaFileUpload } from "react-icons/fa";
import { FaSignOutAlt } from "react-icons/fa";
import { FaPlus } from "react-icons/fa";
import { FaMinus } from "react-icons/fa";
const pdfjsLib = window.pdfjsLib;
const pdfjsViewer = window.pdfjsViewer;

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
  const [pgNum, setPgNum] = useState(1);
  // specific to app state
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const [saveStatus, setSaveStatus] = useState("No Status...");
  const [loadingSpinner, setLoadingSpinner] = useState(false);
  const lastPgNum = useRef();
  let pdfPath = useRef();
  let userState = useRef();
  let resumePgNum = useRef();
  const fileSizeLimit = 20;
  const DEFAULT_SCALE_DELTA = 1.1;
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 10.0;

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
    setSaveStatus("Loading file");
    setLoadingSpinner(true);
    const url = await downloadFileFromFB();
    if (url) {
      console.log("rendering url", url);
      renderInitialPdf(url);
    } else {
      alert("Cant download file, Please report");
    }
  };

  const createPdfEntry = async () => {
    const pdfDetails = {
      pdfLink: pdfPath.current,
      email: userState.current?.email,
    };
    const status = await PostData(configVars.dbUrl + "pdf/new_pdf", {
      pdfDetails: pdfDetails,
    });
    console.log("Pdf Entry Status", status);
  };

  const updatePdfEntry = async () => {
    const pdfDetails = {
      pdfLink: pdfPath.current,
      email: userState.current?.email,
    };
    const status = await PostData(configVars.dbUrl + "pdf/update_pdf_entry", {
      pdfDetails: pdfDetails,
    });
    console.log("Pdf Update Entry Status", status);
  };

  const createOrUpdateUserRecord = async () => {
    const userDetails = {
      email: userState.current?.email,
      displayName: userState.current?.displayName,
    };
    const status = await PostData(configVars.dbUrl + "pdf/create_user", {
      userDetails: userDetails,
    });
    console.log("User created status", status);
  };

  const getOpenedPdf = async () => {
    if (userState.current) {
      /**
       * Fetched State:
       * currPage Page user left reading on
       * pdfLink Path of pdf in fb storage
       */
      const fetchedState = await PostData(configVars.dbUrl + "pdf/resume", {
        email: userState.current?.email,
      });
      console.log("Fetched state", fetchedState);
      let resume = false;
      if (!isEmpty(fetchedState)) {
        resume = true;
        pdfPath.current = fetchedState?.pdfLink;
        resumePgNum.current = fetchedState?.currPage;
      }
      return resume;
    } else {
      console.log("ERROR", "No User State object exists, cant fetch details");
    }
  };

  const formatDatetoTime = () => {
    const date = new Date();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    const prettyDate = hour + ":" + minute + ":" + second;
    return prettyDate;
  };

  const saveOpenedPdfState = async () => {
    if (userState.current) {
      /**
       * saveDetails:
       * email
       * pdfLink
       * currPage
       */
      setSaveStatus("Saving...");
      const saveDetails = {
        email: userState.current?.email,
        pdfLink: pdfPath.current,
        currPage: pgNum,
      };
      const status = await PostData(configVars.dbUrl + "pdf/save", {
        saveDetails: saveDetails,
      });
      console.log("Pdf Save Status", status);
      const saveTime = formatDatetoTime();
      setSaveStatus("Last saved " + saveTime);
    } else {
      console.log(
        "ERROR",
        "No User State object exists, this function should not be called cant fetch anything."
      );
    }
  };

  /**
   * Save user variables
   * uid, email, displayName
   */
  const saveUserState = (user) => {
    userState.current = {
      id: user?.uid,
      email: user?.email,
      name: user?.displayName,
    };
  };

  const handlePageInit = (SEARCH_FOR, tempStateVar) => {
    tempStateVar.eventBus.on("pagesinit", () => {
      // We can use pdfViewer now, e.g. let's change default scale.
      tempStateVar.pdfViewer.currentScaleValue = "page-width";
      tempStateVar.pdfViewer.currentPageNumber = resumePgNum.current;
      // We can try searching for things.
      if (SEARCH_FOR) {
        tempStateVar.pdfFindController.executeCommand("find", {
          query: SEARCH_FOR,
        });
      }
    });
  };

  /**
   * Function calls save state endpoint if user hasnt changed the page in
   * 3 seconds
   * Assuming user isnt constantly scrolling and can save state
   */
  useEffect(() => {
    lastPgNum.current = pgNum;
    setTimeout(() => {
      if (lastPgNum.current === pgNum) {
        saveOpenedPdfState();
      }
    }, 3000);
  }, [pgNum]);

  const handlePageChanging = (tempStateVar) => {
    tempStateVar.eventBus.on("pagechanging", (evt) => {
      setPgNum(evt.pageNumber);
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
    handlePageChanging(tempStateVar);
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
    setLoadingSpinner(false);
  };

  /**
   * Function validates and fixes any page number that user enters
   * @returns fixedPgNum a fixed and valid page number after formatting
   */
  const validateAndFixPgNum = () => {
    const minPg = 1;
    const maxPg = pdfVariables?.pdfDocument?.numPages;
    if (pgNum < minPg) return minPg;
    if (pgNum > maxPg) return maxPg;
    return pgNum;
  };

  const gotoPage = ($ev) => {
    if ($ev.keyCode === 13) {
      $ev.preventDefault();
      const fixedPgNum = validateAndFixPgNum();
      pdfVariables.pdfViewer.currentPageNumber = fixedPgNum;
      setPgNum(fixedPgNum);
    }
  };

  const setPage = ($ev) => {
    const intVal = parseInt($ev.target.value);
    setPgNum(intVal);
  };

  const removePreviousPdf = (prevFilePath) => {
    if (prevFilePath) {
      setSaveStatus("Deleting previous pdf");
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
      setSaveStatus("Uploading new pdf");
      const storageRef = storage.ref();
      const filePath = userState.current?.email + "/" + file.name;
      pdfPath.current = filePath;
      const pdfRef = storageRef.child(filePath);
      pdfRef.put(file).then((snapshot) => {
        alert("File uploaded successfully");
        loadPdf();
      });
    }
  };

  const downloadFileFromFB = async () => {
    const storageRef = storage.ref();
    const url = await storageRef.child(pdfPath.current).getDownloadURL();
    return url;
  };

  const checkFreeTierSize = (bytes) => {
    const kb = bytes / 1024;
    const mb = kb / 1024;
    return mb <= fileSizeLimit ? true : false;
  };

  const uploadAndOpenPdf = async ($ev) => {
    const file = $ev.target.files[0];
    // @mark IMPORTANT
    // At the start and for free versions, user is limited to
    // * 1 pdf
    // * 20mb
    // If user needs to open new pdf:
    // previous pdf should be deleted
    // Their entry in the backend should be updated
    if (file) {
      const sizeCheck = checkFreeTierSize(file.size);
      if (!sizeCheck) {
        alert("Uploads are limited to 20mb");
        return;
      }
      setLoadingSpinner(true);
      const updatePdf = pdfPath.current?.length ? true : false;
      removePreviousPdf(pdfPath.current);
      uploadToFirebaseAndOpen(file);
      if (updatePdf) {
        updatePdfEntry();
      } else {
        createPdfEntry();
      }
      resumePgNum.current = 1;
      setPgNum(1);
    }
  };

  const initPdfRendering = async () => {
    if (isEmpty(userInfo)) {
      return;
    }
    saveUserState(userInfo);
    await createOrUpdateUserRecord();
    const resume = await getOpenedPdf();
    if (resume) loadPdf();
    setSignedIn(true);
  };

  const signInGoogle = async () => {
    const provider = new firebaseRef.auth.GoogleAuthProvider();
    const authRef = await firebaseRef.auth();
    const result = await authRef.signInWithPopup(provider);
    //@mark shift to using tokens for authentication after alpha build
    //    var credential = result.credential;
    // This gives you a Google Access Token. You can use it to access the Google API.
    //    var token = credential.accessToken;
    // The signed-in user info.
    setUserInfo(result.user);
    //@mark TODO implement error catching with awaits
    // .catch((error) => {
    //   // Handle Errors here.
    //   var errorCode = error.code;
    //   var errorMessage = error.message;
    //   // The email of the user's account used.
    //   var email = error.email;
    //   // The firebase.auth.AuthCredential type that was used.
    //   var credential = error.credential;
    // });
  };

  const logoutGoogle = () => {
    firebaseRef
      .auth()
      .signOut()
      .then(() => {
        userState.current = {};
        setSignedIn(false);
      })
      .catch((error) => {
        // Error occurred
      });
  };

  // Performed when user logs in to the page
  // Performed when user logs out
  const authCheck = () => {
    firebaseRef.auth().onAuthStateChanged((user) => {
      if (user) {
        setUserInfo(user);
      } else {
        setSignedIn(false);
      }
    });
  };

  useEffect(() => {
    authCheck();
    // fetchStateAndLoadPdf()
  }, []);

  useEffect(() => {
    initPdfRendering();
  }, [userInfo]);

  const zoomIn = () => {
    let newScale = pdfVariables.pdfViewer.currentScale;
    newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
    newScale = Math.ceil(newScale * 10) / 10;
    newScale = Math.min(MAX_SCALE, newScale);
    pdfVariables.pdfViewer.currentScaleValue = newScale;
  };

  const zoomOut = () => {
    let newScale = pdfVariables.pdfViewer.currentScale;
    newScale = (newScale / DEFAULT_SCALE_DELTA).toFixed(2);
    newScale = Math.floor(newScale * 10) / 10;
    newScale = Math.max(MIN_SCALE, newScale);
    pdfVariables.pdfViewer.currentScaleValue = newScale;
  };

  return (
    <div>
      {signedIn ? (
        <div id="viewerContainer" ref={containerRef}>
          <div id="#viewer" className="pdfViewer" ref={viewerRef} />
        </div>
      ) : null}
      {signedIn ? (
        <div className="toolbar-ctn">
          <div className="start-ctn">
            <label for="file">
              <FaFileUpload className="upload-logo" />
            </label>
            <input
              className="upload-btn"
              type="file"
              id="file"
              accept=".pdf"
              onChange={uploadAndOpenPdf}
            />
          </div>
          {pdfLoaded ? (
            <div className="mid-ctn">
              <div className="ctn-bloc">
                <Dictionary />
                <input
                  type="number"
                  value={pgNum}
                  onChange={setPage}
                  onKeyDown={gotoPage}
                  className="toolbar-input"
                />
                <div className="pg-text">of</div>
                <div id="total-pages">
                  {pdfVariables?.pdfDocument?.numPages}
                </div>
              </div>
              <div className="ctn-bloc">
                <FaMinus onClick={zoomOut} className="zoom-logo" />
                <FaPlus onClick={zoomIn} className="zoom-logo" />
              </div>
            </div>
          ) : null}
          <div className="end-ctn">
            <DarkModeBtn />
            <div className="saving-status">{saveStatus}</div>
            {loadingSpinner ? <div className="loader" /> : null}
            <FaSignOutAlt
              onClick={logoutGoogle}
              className="logout-btn"
              label="Logout"
            />
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
