// Domain Redirect Script
// Redirects any access from firebaseapp.com to the main domain simpletcf.com
// This runs immediately to prevent SSL certificate errors during Google OAuth redirects
(function () {
  const hostname = window.location.hostname;
  if (hostname === "simpletcf.firebaseapp.com") {
    const target =
      "https://simpletcf.com" +
      window.location.pathname +
      window.location.search +
      window.location.hash;
    window.location.replace(target);
  }
})();
