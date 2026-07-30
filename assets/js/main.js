    (function () {
      var i18nVersionMeta = document.querySelector('meta[name="i18n-version"]');
      var i18nVersion = i18nVersionMeta ? i18nVersionMeta.getAttribute("content") : "2026-05-14-03";
      var languageFiles = {
        lv: "./locales/lv.json",
        ru: "./locales/ru.json",
        en: "./locales/en.json"
      };
      var fallbackLanguage = "lv";
      var languageCache = {};
      var heroUnderlineWords = { lv: "pirkstiem", en: "cracks", ru: "по пути" };
      var soulUnderlineSvg = '<svg class="soul-underline-svg" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2,8 C30,2 50,12 80,6 C100,2 110,8 118,6"/></svg>';

      function escapeHtml(str) {
        return str.replace(/[&<>"']/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
      }

      function renderHeroTitle(node, text, lang) {
        var word = heroUnderlineWords[lang];
        var idx = word ? text.indexOf(word) : -1;
        if (idx === -1) {
          node.textContent = text;
          return;
        }
        var before = escapeHtml(text.slice(0, idx));
        var after = escapeHtml(text.slice(idx + word.length));
        node.innerHTML = before + '<span class="soul-underline">' + escapeHtml(word) + soulUnderlineSvg + "</span>" + after;
      }
      var siteOrigin = "https://www.sia-robotics-consulting.eu";
      var canonicalPath = "/";

      function langUrl(lang) {
        return siteOrigin + canonicalPath + (lang === fallbackLanguage ? "" : "?lang=" + lang);
      }

      function getLangFromUrl() {
        var params = new URLSearchParams(globalThis.location.search || "");
        var urlLang = params.get("lang");
        return languageFiles[urlLang] ? urlLang : null;
      }

      function syncLangUrl(lang) {
        var params = new URLSearchParams(globalThis.location.search || "");
        if (lang === fallbackLanguage) {
          params.delete("lang");
        } else {
          params.set("lang", lang);
        }
        var query = params.toString();
        var newUrl = globalThis.location.pathname + (query ? "?" + query : "") + globalThis.location.hash;
        globalThis.history.replaceState(null, "", newUrl);
      }
      var counterStartConfigPath = "./assets/counter.json";
      var counterApiEndpoint = "https://robotics-counter-worker.sia-robotics-consulting.workers.dev/api/counter";
      // rcTurnstileToken, rcTurnstileResolvers, rcOnTurnstileToken defined in <head>
      var counterStartCache;
      var ownerCounterToken = "rc-owner-2026-05-14-v7p9k3";
      var counterLastKnownStorageKey = "rc-counter-last-known-v7p9k3";
      var ownerCounterStorageKey = "rc-owner-counter-enabled";
      var visitorCounterWrap = document.getElementById("visitor-counter");
      var visitorCountNode = document.getElementById("visitor-count-value");

      function isOwnerCounterEnabled() {
        var params = new URLSearchParams(globalThis.location.search || "");
        var providedToken = params.get("counter_access");

        if (providedToken && providedToken === ownerCounterToken) {
          try {
            localStorage.setItem(ownerCounterStorageKey, "1");
          } catch (error) {
            console.debug("Owner counter localStorage write is unavailable", error);
          }

          params.delete("counter_access");
          var query = params.toString();
          var cleanUrl = globalThis.location.pathname + (query ? "?" + query : "") + globalThis.location.hash;
          globalThis.history.replaceState(null, "", cleanUrl);
          return true;
        }

        try {
          return localStorage.getItem(ownerCounterStorageKey) === "1";
        } catch (error) {
          console.debug("Owner counter localStorage read is unavailable", error);
          return false;
        }
      }

      function setVisitorCounterVisible(visible) {
        if (!visitorCounterWrap) return;
        visitorCounterWrap.hidden = !visible;
      }

      function setVisitorCount(value) {
        if (!visitorCountNode) return;
        if (typeof value !== "number" || !Number.isFinite(value)) {
          visitorCountNode.textContent = "-";
          return;
        }
        visitorCountNode.textContent = value.toLocaleString();
      }

      function getStoredCounterValue() {
        try {
          var raw = localStorage.getItem(counterLastKnownStorageKey);
          if (raw === null) return null;
          var parsed = Number(raw);
          return Number.isFinite(parsed) ? parsed : null;
        } catch (error) {
          console.debug("Counter last-known-value read is unavailable", error);
          return null;
        }
      }

      function storeCounterValue(value) {
        if (typeof value !== "number" || !Number.isFinite(value)) return;
        try {
          localStorage.setItem(counterLastKnownStorageKey, String(value));
        } catch (error) {
          console.debug("Counter last-known-value write is unavailable", error);
        }
      }

      function getTurnstileToken() {
        if (rcTurnstileToken) return Promise.resolve(rcTurnstileToken);
        return new Promise(function (resolve, reject) {
          var timer = setTimeout(function () {
            var idx = rcTurnstileResolvers.indexOf(onToken);
            if (idx !== -1) rcTurnstileResolvers.splice(idx, 1);
            reject(new Error("Turnstile timeout"));
          }, 15000);
          function onToken(token) { clearTimeout(timer); resolve(token); }
          rcTurnstileResolvers.push(onToken);
        });
      }

      function hasConfiguredCounterEndpoint() {
        if (typeof counterApiEndpoint !== "string") return false;
        var endpoint = counterApiEndpoint.trim();
        if (!endpoint) return false;
        if (endpoint.includes("replace-with-your-worker.workers.dev")) return false;
        return endpoint.includes("/api/counter");
      }

      function loadCounterStart() {
        if (typeof counterStartCache === "number") return Promise.resolve(counterStartCache);

        return fetch(counterStartConfigPath + "?v=" + encodeURIComponent(ownerCounterToken))
          .then(function (response) {
            if (!response.ok) throw new Error("Counter start config request failed");
            return response.json();
          })
          .then(function (payload) {
            if (!payload || typeof payload.value !== "number" || !Number.isFinite(payload.value)) {
              throw new Error("Counter start config is invalid");
            }
            counterStartCache = payload.value;
            return counterStartCache;
          });
      }

      function handleCounterFetchError(isOwnerView) {
        if (!isOwnerView) return;
        var lastKnownValue = getStoredCounterValue();
        if (lastKnownValue !== null) {
          setVisitorCount(lastKnownValue);
          return;
        }
        loadCounterStart()
          .then(function (counterStart) {
            setVisitorCount(counterStart);
            storeCounterValue(counterStart);
          })
          .catch(function () {
            setVisitorCount(null);
          });
      }

      function doCounterFetch(mode, tsToken, isOwnerView, hasVisited, localFlag) {
        var fetchUrl = counterApiEndpoint + "?mode=" + encodeURIComponent(mode);
        if (tsToken) fetchUrl += "&ts_token=" + encodeURIComponent(tsToken);
        return fetch(fetchUrl)
          .then(function (response) {
            if (!response.ok) throw new Error("Visitor counter request failed");
            return response.json();
          })
          .then(function (payload) {
            if (!payload || typeof payload.value !== "number" || !Number.isFinite(payload.value)) {
              throw new Error("Visitor counter response is invalid");
            }
            if (!hasVisited) {
              try {
                localStorage.setItem(localFlag, "1");
              } catch (error) {
                console.debug("Visitor counter localStorage write is unavailable", error);
              }
            }
            if (!isOwnerView) return null;
            setVisitorCount(payload.value);
            storeCounterValue(payload.value);
            return null;
          })
          .catch(function () { handleCounterFetchError(isOwnerView); });
      }

      function updateUniqueVisitorCount() {
        var localFlag = "rc-unique-visitor-v3";
        var hasVisited = false;
        var isOwnerView = isOwnerCounterEnabled();

        try {
          hasVisited = localStorage.getItem(localFlag) === "1";
        } catch (error) {
          console.debug("Visitor counter localStorage read is unavailable", error);
          hasVisited = false;
        }

        if (!hasConfiguredCounterEndpoint()) {
          if (!isOwnerView) return;

          console.warn("Visitor counter backend is not configured. Set counterApiEndpoint to your deployed Worker URL.");

          var fallbackValue = getStoredCounterValue();
          if (fallbackValue !== null) {
            setVisitorCount(fallbackValue);
            return;
          }

          loadCounterStart()
            .then(function (counterStart) {
              setVisitorCount(counterStart);
              storeCounterValue(counterStart);
            })
            .catch(function () {
              setVisitorCount(null);
            });
          return;
        }

        if (!isOwnerView && hasVisited) return;

        var mode = hasVisited ? "get" : "hit";

        if (mode === "hit") {
          getTurnstileToken()
            .then(function (tsToken) { return doCounterFetch(mode, tsToken, isOwnerView, hasVisited, localFlag); })
            .catch(function () {
              console.debug("Turnstile token unavailable, skipping counter hit.");
              // Still fetch current value for owner so they see live data
              doCounterFetch("get", null, isOwnerView, true, localFlag);
            });
        } else {
          doCounterFetch(mode, null, isOwnerView, hasVisited, localFlag);
        }
      }

      function buildLanguageUrl(lang) {
        return languageFiles[lang] + "?v=" + encodeURIComponent(i18nVersion);
      }

      function loadLanguage(lang) {
        var selected = languageFiles[lang] ? lang : fallbackLanguage;
        if (languageCache[selected]) return Promise.resolve(languageCache[selected]);

        return fetch(buildLanguageUrl(selected))
          .then(function (response) {
            if (!response.ok) throw new Error("Failed to load language: " + selected);
            return response.json();
          })
          .then(function (copy) {
            languageCache[selected] = copy;
            return copy;
          });
      }

      function applyLanguage(lang) {
        var selected = languageFiles[lang] ? lang : fallbackLanguage;
        return loadLanguage(selected).catch(function () {
          if (selected === fallbackLanguage) return null;
          selected = fallbackLanguage;
          return loadLanguage(fallbackLanguage);
        }).then(function (copy) {
          if (!copy) return;
        var descriptionMeta = document.querySelector('meta[name="description"]');
        var leadmagLink = document.getElementById("leadmag-link");
        var heroLeadmagLink = document.getElementById("hero-leadmag-link");
        var aiImplementationLink = document.getElementById("offer-ai-link");
        var menuToggle = document.querySelector(".menu-toggle");
        document.documentElement.lang = selected;
        document.title = copy.page_title;
        if (descriptionMeta) descriptionMeta.setAttribute("content", copy.page_desc);

        globalThis.rcCopy = copy;

        document.querySelectorAll("[data-i18n]").forEach(function (node) {
          var key = node.dataset.i18n;
          if (!Object.hasOwn(copy, key)) return;
          if (key === "hero_title") {
            renderHeroTitle(node, copy[key], selected);
          } else {
            node.textContent = copy[key];
          }
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach(function (node) {
          var phKey = node.dataset.i18nPlaceholder;
          if (phKey && Object.hasOwn(copy, phKey)) node.setAttribute("placeholder", copy[phKey]);
        });

        if (globalThis.innerWidth <= 760) {
          document.querySelectorAll("[data-i18n-mobile]").forEach(function (node) {
            var mobileKey = node.dataset.i18nMobile;
            if (mobileKey && Object.hasOwn(copy, mobileKey)) node.textContent = copy[mobileKey];
          });
        }

        if (leadmagLink && copy.leadmag_href) {
          leadmagLink.href = copy.leadmag_href;
        }

        if (heroLeadmagLink && copy.leadmag_href) {
          heroLeadmagLink.href = copy.leadmag_href;
        }

        if (aiImplementationLink && copy.ai_doc_href) {
          aiImplementationLink.href = copy.ai_doc_href;
        }

        if (menuToggle && copy.nav_menu) {
          menuToggle.setAttribute("aria-label", copy.nav_menu);
        }

        document.querySelectorAll(".lang-btn").forEach(function (btn) {
          var isActive = btn.dataset.lang === selected;
          btn.classList.toggle("active", isActive);
          btn.setAttribute("aria-pressed", String(isActive));
        });

        var canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink) canonicalLink.setAttribute("href", langUrl(selected));
        var ogUrlMeta = document.querySelector('meta[property="og:url"]');
        if (ogUrlMeta) ogUrlMeta.setAttribute("content", langUrl(selected));

        try {
          localStorage.setItem("preferred-language", selected);
        } catch (error) {
          console.debug("Preferred-language write is unavailable", error);
        }
        syncLangUrl(selected);
        });
      }

      document.querySelectorAll(".lang-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          applyLanguage(btn.dataset.lang);
        });
      });

      var header = document.querySelector("header");
      var menuToggle = document.querySelector(".menu-toggle");
      var miniNav = document.querySelector(".mini-nav");
      if (miniNav) miniNav.id = "mobile-site-nav";

      function closeMenu() {
        if (!header || !menuToggle) return;
        header.classList.remove("menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
        setMobileCtaHidden(false);
      }

      var mobileCtaBar = document.querySelector(".mobile-cta-bar");
      var lastScrollY = 0;

      function setMobileCtaHidden(hidden) {
        if (!mobileCtaBar) return;
        mobileCtaBar.classList.toggle("is-hidden", hidden);
      }

      if (menuToggle && header) {
        menuToggle.addEventListener("click", function () {
          var isOpen = header.classList.toggle("menu-open");
          menuToggle.setAttribute("aria-expanded", String(isOpen));
          setMobileCtaHidden(isOpen);
        });
      }

      document.addEventListener("click", function (event) {
        if (!header || !menuToggle || globalThis.innerWidth > 760) return;
        if (!header.classList.contains("menu-open")) return;
        if (header.contains(event.target)) return;
        closeMenu();
      });

      document.querySelectorAll(".mini-nav a").forEach(function (link) {
        link.addEventListener("click", closeMenu);
      });

      var faqItems = Array.from(document.querySelectorAll(".faq-item"));
      faqItems.forEach(function (item) {
        var toggle = item.querySelector(".faq-toggle");
        if (!toggle) return;
        toggle.addEventListener("click", function () {
          var shouldOpen = !item.classList.contains("is-open");
          faqItems.forEach(function (other) {
            other.classList.remove("is-open");
            var otherToggle = other.querySelector(".faq-toggle");
            if (otherToggle) otherToggle.setAttribute("aria-expanded", "false");
          });
          if (!shouldOpen) return;
          item.classList.add("is-open");
          toggle.setAttribute("aria-expanded", "true");
        });
      });

      var serviceCards = Array.from(document.querySelectorAll(".service-card--collapsible"));

      function syncServiceCards() {
        var isMobile = globalThis.innerWidth <= 760;
        serviceCards.forEach(function (card) {
          var toggle = card.querySelector(".service-toggle");
          var body = card.querySelector(".service-card-body");
          if (!toggle || !body) return;

          if (!isMobile) {
            body.hidden = false;
            toggle.setAttribute("aria-expanded", "true");
            return;
          }


          var isOpen = card.classList.contains("is-open");
          body.hidden = !isOpen;
          toggle.setAttribute("aria-expanded", String(isOpen));
        });
      }

      serviceCards.forEach(function (card) {
        var toggle = card.querySelector(".service-toggle");
        if (!toggle) return;
        toggle.addEventListener("click", function () {
          if (globalThis.innerWidth > 760) return;
          var shouldOpen = !card.classList.contains("is-open");
          serviceCards.forEach(function (other) {
            other.classList.remove("is-open");
          });
          if (shouldOpen) card.classList.add("is-open");
          syncServiceCards();
        });
      });

      syncServiceCards();

      globalThis.addEventListener("resize", function () {
        if (globalThis.innerWidth > 760) closeMenu();
        applyLanguage(document.documentElement.lang || fallbackLanguage);
        syncServiceCards();
      });

      globalThis.addEventListener("scroll", function () {
        if (!mobileCtaBar || globalThis.innerWidth > 760) return;
        var currentY = globalThis.scrollY || 0;
        if (Math.abs(currentY - lastScrollY) < 8) return;
        if (currentY < 72) {
          setMobileCtaHidden(false);
          lastScrollY = currentY;
          return;
        }
        setMobileCtaHidden(currentY > lastScrollY);
        lastScrollY = currentY;
      }, { passive: true });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && header && header.classList.contains("menu-open")) closeMenu();
      });

      // Theme toggle
      var themeToggleBtn = document.getElementById('theme-toggle-btn');
      var currentTheme = null;
      try {
        currentTheme = localStorage.getItem('rc-theme');
      } catch (error) {
        console.debug("Theme preference read is unavailable", error);
      }
      // Split out of setTheme: re-rendering a third-party widget is its own concern,
      // and keeping it inline pushed setTheme over the cognitive-complexity limit.
      function syncCaptchaTheme(theme) {
        var hc = document.querySelector('.h-captcha');
        if (!hc) return;
        var hcTheme = theme === 'light' ? 'light' : 'dark';
        hc.dataset.theme = hcTheme;
        // Once hCaptcha has auto-rendered, changing the attribute alone has no
        // effect (the theme is baked into the widget's iframe at render time),
        // so the widget has to be torn down and re-rendered to pick it up.
        if (!hc.dataset.sitekey || !globalThis.hcaptcha || typeof globalThis.hcaptcha.render !== "function") return;
        try {
          globalThis.hcaptcha.remove();
          globalThis.hcaptcha.render(hc, {
            sitekey: hc.dataset.sitekey,
            theme: hcTheme,
            hl: hc.dataset.hl || fallbackLanguage
          });
        } catch (error) {
          console.debug("hCaptcha re-render on theme change failed", error);
        }
      }

      function setTheme(theme) {
        if (theme === 'light') {
          document.documentElement.dataset.theme = 'light';
          if (themeToggleBtn) themeToggleBtn.textContent = '🌙';
        } else {
          delete document.documentElement.dataset.theme;
          if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
        }
        try {
          localStorage.setItem('rc-theme', theme);
        } catch (error) {
          console.debug("Theme preference write is unavailable", error);
        }
        syncCaptchaTheme(theme);
      }
      if (currentTheme === 'light') setTheme('light');
      if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function() {
          var isLight = document.documentElement.dataset.theme === 'light';
          setTheme(isLight ? 'dark' : 'light');
        });
      }

      var urlLanguage = getLangFromUrl();
      var savedLanguage = null;
      try {
        savedLanguage = localStorage.getItem("preferred-language");
      } catch (error) {
        console.debug("Preferred-language read is unavailable", error);
      }
      var initialLanguage = urlLanguage || savedLanguage || "lv";
      if (!languageFiles[initialLanguage]) initialLanguage = "lv";
      // Pin hCaptcha's language to the site language (not the browser locale)
      // before Web3Forms' async script renders the widget.
      var hcaptchaEl = document.querySelector(".h-captcha");
      if (hcaptchaEl) hcaptchaEl.dataset.hl = initialLanguage;
      applyLanguage(initialLanguage);

      var isOwnerView = isOwnerCounterEnabled();
      setVisitorCounterVisible(isOwnerView);
      updateUniqueVisitorCount();

      (function initContactForm() {
        var form = document.getElementById("contact-form");
        var status = document.getElementById("contact-status");
        if (!form || !status) return;
        var submitBtn = form.querySelector('button[type="submit"]');

        function t(key, fallback) {
          var copy = globalThis.rcCopy;
          return (copy && copy[key]) || fallback;
        }

        var CONTACT_EMAIL = "latvia.robotics@gmail.com";
        function showError() {
          status.className = "rc-form-status is-error";
          var msg = t("contact_error", "Something went wrong sending that. Please try again, or {email}.");
          var link = '<a href="mailto:' + CONTACT_EMAIL + '">' + t("contact_error_link", "email me directly") + '</a>';
          if (msg.includes("{email}")) {
            status.innerHTML = msg.replace("{email}", link);
          } else {
            status.textContent = msg;
          }
        }

        var whatsappLink = document.getElementById("whatsapp-contact-link");
        if (whatsappLink) {
          whatsappLink.addEventListener("click", function () {
            rcTrack("Contact", { method: "whatsapp" }, { gaEvent: "generate_lead" });
          });
        }

        var phoneLink = document.getElementById("phone-contact-link");
        if (phoneLink) {
          phoneLink.addEventListener("click", function () {
            rcTrack("Contact", { method: "phone" }, { gaEvent: "generate_lead" });
          });
        }

        form.addEventListener("submit", function (event) {
          event.preventDefault();
          status.className = "rc-form-status";
          status.textContent = "";

          var accessKey = form.querySelector('input[name="access_key"]');
          if (!accessKey || !accessKey.value || accessKey.value === "YOUR_WEB3FORMS_ACCESS_KEY") {
            showError();
            return;
          }

          var hcaptchaField = form.querySelector('textarea[name="h-captcha-response"]');
          if (hcaptchaField && !hcaptchaField.value) {
            status.className = "rc-form-status is-error";
            status.textContent = t("contact_turnstile", "Please complete the verification and try again.");
            return;
          }

          var originalLabel = submitBtn ? submitBtn.textContent : "";
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = t("contact_sending", "Sending…");
          }

          fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Accept": "application/json" },
            body: new FormData(form)
          })
            .then(function (response) { return response.json(); })
            .then(function (data) {
              if (data && data.success) {
                status.classList.add("is-success");
                status.textContent = t("contact_success", "Thanks — your message is on its way.");
                form.reset();
                rcTrack("Lead", undefined, { gaEvent: "generate_lead" });
              } else {
                console.error("Web3Forms rejected the submission:", data);
                showError();
              }
            })
            .catch(function (err) {
              console.error("Contact form request failed:", err);
              showError();
            })
            .finally(function () {
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalLabel || t("contact_send_btn", "Send Message");
              }
              if (globalThis.hcaptcha && typeof globalThis.hcaptcha.reset === "function") {
                globalThis.hcaptcha.reset();
              }
            });
        });
      })();

      (function initFrameReveal() {
        var cards = document.querySelectorAll(".frame-reveal");
        if (!cards.length) return;
        var reduceMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

        function sizeFrame(card) {
          var svg = card.querySelector(".frame-reveal-svg");
          var rect = svg && svg.querySelector("rect");
          if (!rect) return;
          var w = card.clientWidth;
          var h = card.clientHeight;
          svg.setAttribute("viewBox", "0 0 " + w + " " + h);
          var inset = 1;
          rect.setAttribute("x", inset);
          rect.setAttribute("y", inset);
          rect.setAttribute("width", Math.max(0, w - inset * 2));
          rect.setAttribute("height", Math.max(0, h - inset * 2));
          rect.setAttribute("rx", Number.parseFloat(getComputedStyle(card).borderTopLeftRadius) || 20);
          rect.style.setProperty("--dash-length", rect.getTotalLength());
        }

        cards.forEach(sizeFrame);

        if (typeof ResizeObserver === "function") {
          var resizeObserver = new ResizeObserver(function (entries) {
            entries.forEach(function (entry) { sizeFrame(entry.target); });
          });
          cards.forEach(function (card) { resizeObserver.observe(card); });
        }

        if (reduceMotion) {
          cards.forEach(function (card) { card.classList.add("in-view"); });
          return;
        }

        var frameObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("in-view");
            frameObserver.unobserve(entry.target);
          });
        }, { threshold: 0.2, rootMargin: "0px 0px -6% 0px" });
        cards.forEach(function (card) { frameObserver.observe(card); });
      })();

      if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      var revealNodes = document.querySelectorAll(".reveal");
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.16, rootMargin: "0px 0px -6% 0px" });
      revealNodes.forEach(function (node) {
        observer.observe(node);
      });
    })();

    // Engagement funnel: PageView -> Scroll50 -> ViewContent -> CTAClick/FormStart -> Lead.
    // Without these middle steps there is no way to tell "visitors never reach the
    // form" from "they reach it and don't want it" — opposite problems.
    //
    // Deliberately its own IIFE *after* the main one: the block above returns early
    // for reduced-motion users, and keeping this separate also means a failure here
    // can never take down the contact form's setup, which runs earlier.
    (function initEngagementTracking() {
      var fired = {};

      function once(key, name, params, opts) {
        if (fired[key]) return;
        fired[key] = true;
        rcTrack(name, params, opts);
      }

      function onScroll() {
        var doc = document.documentElement;
        var scrollable = doc.scrollHeight - globalThis.innerHeight;
        if (scrollable <= 0) return;
        if ((doc.scrollTop || document.body.scrollTop) / scrollable >= 0.5) {
          once("scroll50", "Scroll50", undefined, { custom: true });
          globalThis.removeEventListener("scroll", onScroll);
        }
      }
      globalThis.addEventListener("scroll", onScroll, { passive: true });

      var contactSection = document.getElementById("contact");
      if (contactSection && typeof IntersectionObserver === "function") {
        var contactObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            once("viewContact", "ViewContent", { content_name: "contact-section" });
            contactObserver.unobserve(entry.target);
          });
        }, { threshold: 0.3 });
        contactObserver.observe(contactSection);
      }

      var contactForm = document.getElementById("contact-form");
      if (contactForm) {
        contactForm.addEventListener("focusin", function () {
          once("formStart", "FormStart", undefined, { custom: true });
        });
      }

      document.addEventListener("click", function (event) {
        var node = event.target;
        if (!node || typeof node.closest !== "function") return;
        var link = node.closest("a, button");
        if (!link) return;

        if (link.id === "leadmag-link" || link.id === "hero-leadmag-link") {
          once("checklist", "ChecklistDownload", undefined, { custom: true, gaEvent: "file_download" });
          return;
        }

        if (link.classList.contains("btn") && link.closest(".cta, .cta-box, .mobile-cta-bar")) {
          once("ctaClick", "CTAClick", { cta: (link.textContent || "").trim().slice(0, 60) },
               { custom: true, gaEvent: "select_content" });
        }
      });
    })();
