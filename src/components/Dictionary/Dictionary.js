import { useRef, useState, useEffect } from "react";
import "./Dictionary.css";

function Dictionary() {
  const [dictMode, setDictMode] = useState(false);
  const [searchW, setSearchW] = useState("");
  const [togglePopup, setTogglePopup] = useState(false);
  const [popupDims, setPopupDims] = useState({ x: 0, y: 0 });

  const SelectionDetector = () => {
    if (window.getSelection) {
      const text = window.getSelection().toString();
      setSearchW(text);
    }
  };
  const toggleDictMode = () => {
    if (dictMode) {
      setDictMode(false);
    } else {
      setDictMode(true);
    }
  };

  useEffect(() => {
    document.addEventListener("selectionchange", () => {
      SelectionDetector();
    });
    document.addEventListener("mousedown", () => {
      setTogglePopup(false);
    });
    document.addEventListener("mouseup", (event) => {
      if (!dictMode) return;
      setTogglePopup(true);
      let popupY = event?.y + event?.path[0]?.clientHeight;
      let popupX = event?.path[0]?.offsetLeft;
      setPopupDims({ top: popupY, left: popupX });
    });
  }, []);

  return (
    <>
      {togglePopup && dictMode ? (
        <div className="popup" style={popupDims}>
          {searchW}
        </div>
      ) : null}
      <button onClick={toggleDictMode}>
        Dictionary {dictMode ? "On" : "Off"}
      </button>
    </>
  );
}

export default Dictionary;
