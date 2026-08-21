// import { useEffect } from 'react';
// import { useLocation } from 'react-router-dom';

// const ScrollToTop = () => {
//   const { pathname } = useLocation();

//   useEffect(() => {
//     window.scrollTo(0, 0);
//   }, [pathname]);

//   return null;
// };

// export default ScrollToTop;




import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    // Reset browser/window scroll
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });

    // Reset CRM main content scroll
    const mainScrollContainer = document.getElementById(
      "main-scroll-container"
    );

    if (mainScrollContainer) {
      mainScrollContainer.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant",
      });
    }
  }, [location.pathname]);

  return null;
};

export default ScrollToTop;