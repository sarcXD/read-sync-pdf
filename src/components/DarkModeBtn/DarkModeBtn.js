import { useRef, useState, useEffect } from "react";
import { MdOutlineDarkMode, MdOutlineLightMode } from "react-icons/md";
import "./DarkModeBtn.css";

function DarkModeBtn() {
  const [theme, setTheme] = useState("light");
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };
  return (
    <ul onClick={() => toggleTheme()}>
      <li>Theme</li>
      <li className="theme-ctn">
        {theme === "light" ? (
          <MdOutlineDarkMode className="theme-btn" />
        ) : (
          <MdOutlineLightMode className="theme-btn" />
        )}
      </li>
    </ul>
  );
}

export default DarkModeBtn;
