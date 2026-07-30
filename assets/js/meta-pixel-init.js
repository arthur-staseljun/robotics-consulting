        if (rcIsProd) {
          (function (f, b, e, v) {
              if (f.fbq) return;
              const n = f.fbq = function () {
                  n.callMethod ? n.callMethod(...arguments) : n.queue.push(arguments);
              };
              if (!f._fbq) f._fbq = n;
              n.push = n;
              n.loaded = true;
              n.version = "2.0";
              n.queue = [];
              const t = b.createElement(e);
              t.async = true;
              t.src = v;
              const s = b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t, s);
          })(globalThis, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
          fbq("init", "1264801605722112");
        }
        // Outside the guard on purpose: rcTrack already gates the actual send, so
        // off-prod this still logs to the console and PageView stays visible when
        // debugging the funnel.
        rcTrack("PageView");
