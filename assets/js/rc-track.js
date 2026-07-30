        (function () {
          const rcDebugParam = new URLSearchParams(globalThis.location.search || "").get("rc_debug");
          if (rcDebugParam === "1" || rcDebugParam === "0") {
            try {
              if (rcDebugParam === "1") localStorage.setItem("rc-debug-mode", "1");
              else localStorage.removeItem("rc-debug-mode");
            } catch (error) {
              console.debug("rc_debug localStorage is unavailable", error);
            }
          }
        })();

        const rcDebugMode = (function () {
          try {
            return localStorage.getItem("rc-debug-mode") === "1";
          } catch (error) {
            console.debug("Debug-mode localStorage read is unavailable", error);
            return false;
          }
        })();

        const rcIsProd = globalThis.location.hostname === "www.sia-robotics-consulting.eu" && !rcDebugMode;

        function rcTrack(name, params, opts) {
          if (!rcIsProd) {
            console.debug("[track]", name, params || "");
            return;
          }
          try {
            if (typeof fbq === "function") {
              fbq(opts?.custom ? "trackCustom" : "track", name, params);
            }
            if (opts?.gaEvent && typeof gtag === "function") {
              gtag("event", opts.gaEvent, params);
            }
          } catch (error) {
            console.debug("Tracking is unavailable", error);
          }
        }
