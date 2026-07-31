    (function () {
      const i18nVersionMeta = document.querySelector('meta[name="i18n-version"]');
      const i18nVersion = i18nVersionMeta ? i18nVersionMeta.getAttribute("content") : "2026-05-14-03";
      const languageFiles = {
        lv: "./locales/lv.json",
        ru: "./locales/ru.json",
        en: "./locales/en.json"
      };
      const fallbackLanguage = "lv";
      const languageCache = {};
      const heroUnderlineWords = { lv: "vienā sistēmā", en: "in one system", ru: "в одной системе" };
      const soulUnderlineSvg = '<svg class="soul-underline-svg" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2,8 C30,2 50,12 80,6 C100,2 110,8 118,6"/></svg>';

      function escapeHtml(str) {
        return str.replace(/[&<>"']/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
      }

      function renderHeroTitle(node, text, lang) {
        const word = heroUnderlineWords[lang];
        const idx = word ? text.indexOf(word) : -1;
        if (idx === -1) {
          node.textContent = text;
          return;
        }
        const before = escapeHtml(text.slice(0, idx));
        const after = escapeHtml(text.slice(idx + word.length));
        node.innerHTML = before + '<span class="soul-underline">' + escapeHtml(word) + soulUnderlineSvg + "</span>" + after;
      }
      const siteOrigin = "https://www.sia-robotics-consulting.eu";
      const canonicalPath = "/";

      function langUrl(lang) {
        return siteOrigin + canonicalPath + (lang === fallbackLanguage ? "" : "?lang=" + lang);
      }

      function getLangFromUrl() {
        const params = new URLSearchParams(globalThis.location.search || "");
        const urlLang = params.get("lang");
        return languageFiles[urlLang] ? urlLang : null;
      }

      function syncLangUrl(lang) {
        const params = new URLSearchParams(globalThis.location.search || "");
        if (lang === fallbackLanguage) {
          params.delete("lang");
        } else {
          params.set("lang", lang);
        }
        const query = params.toString();
        const newUrl = globalThis.location.pathname + (query ? "?" + query : "") + globalThis.location.hash;
        globalThis.history.replaceState(null, "", newUrl);
      }
      const counterStartConfigPath = "./assets/counter.json";
      const counterApiEndpoint = "https://robotics-counter-worker.sia-robotics-consulting.workers.dev/api/counter";
      // rcTurnstileToken, rcTurnstileResolvers, rcOnTurnstileToken defined in <head>
      let counterStartCache;
      const ownerCounterToken = "rc-owner-2026-05-14-v7p9k3";
      const counterLastKnownStorageKey = "rc-counter-last-known-v7p9k3";
      const ownerCounterStorageKey = "rc-owner-counter-enabled";
      const visitorCounterWrap = document.getElementById("visitor-counter");
      const visitorCountNode = document.getElementById("visitor-count-value");

      function isOwnerCounterEnabled() {
        const params = new URLSearchParams(globalThis.location.search || "");
        const providedToken = params.get("counter_access");

        if (providedToken && providedToken === ownerCounterToken) {
          try {
            localStorage.setItem(ownerCounterStorageKey, "1");
          } catch (error) {
            console.debug("Owner counter localStorage write is unavailable", error);
          }

          params.delete("counter_access");
          const query = params.toString();
          const cleanUrl = globalThis.location.pathname + (query ? "?" + query : "") + globalThis.location.hash;
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
          const raw = localStorage.getItem(counterLastKnownStorageKey);
          if (raw === null) return null;
          const parsed = Number(raw);
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
          const timer = setTimeout(function () {
            const idx = rcTurnstileResolvers.indexOf(onToken);
            if (idx !== -1) rcTurnstileResolvers.splice(idx, 1);
            reject(new Error("Turnstile timeout"));
          }, 15000);
          function onToken(token) { clearTimeout(timer); resolve(token); }
          rcTurnstileResolvers.push(onToken);
        });
      }

      function hasConfiguredCounterEndpoint() {
        if (typeof counterApiEndpoint !== "string") return false;
        const endpoint = counterApiEndpoint.trim();
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
        const lastKnownValue = getStoredCounterValue();
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
        let fetchUrl = counterApiEndpoint + "?mode=" + encodeURIComponent(mode);
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
        const localFlag = "rc-unique-visitor-v3";
        let hasVisited = false;
        const isOwnerView = isOwnerCounterEnabled();

        try {
          hasVisited = localStorage.getItem(localFlag) === "1";
        } catch (error) {
          console.debug("Visitor counter localStorage read is unavailable", error);
          hasVisited = false;
        }

        if (!hasConfiguredCounterEndpoint()) {
          if (!isOwnerView) return;

          console.warn("Visitor counter backend is not configured. Set counterApiEndpoint to your deployed Worker URL.");

          const fallbackValue = getStoredCounterValue();
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

        const mode = hasVisited ? "get" : "hit";

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
        const selected = languageFiles[lang] ? lang : fallbackLanguage;
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

      function setHrefIfPresent(el, href) {
        if (el && href) el.href = href;
      }

      function applyLanguage(lang) {
        let selected = languageFiles[lang] ? lang : fallbackLanguage;
        return loadLanguage(selected).catch(function () {
          if (selected === fallbackLanguage) return null;
          selected = fallbackLanguage;
          return loadLanguage(fallbackLanguage);
        }).then(function (copy) {
          if (!copy) return;
        const descriptionMeta = document.querySelector('meta[name="description"]');
        const aboutCvLink = document.getElementById("about-cv-link");
        const menuToggle = document.querySelector(".menu-toggle");
        document.documentElement.lang = selected;
        document.title = copy.page_title;
        if (descriptionMeta) descriptionMeta.setAttribute("content", copy.page_desc);

        globalThis.rcCopy = copy;

        document.querySelectorAll("[data-i18n]").forEach(function (node) {
          const key = node.dataset.i18n;
          if (!Object.hasOwn(copy, key)) return;
          if (key === "hero_title") {
            renderHeroTitle(node, copy[key], selected);
          } else {
            node.textContent = copy[key];
          }
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach(function (node) {
          const phKey = node.dataset.i18nPlaceholder;
          if (phKey && Object.hasOwn(copy, phKey)) node.setAttribute("placeholder", copy[phKey]);
        });

        if (globalThis.innerWidth <= 760) {
          document.querySelectorAll("[data-i18n-mobile]").forEach(function (node) {
            const mobileKey = node.dataset.i18nMobile;
            if (mobileKey && Object.hasOwn(copy, mobileKey)) node.textContent = copy[mobileKey];
          });
        }

        setHrefIfPresent(aboutCvLink, copy.about_cv_href);

        if (menuToggle && copy.nav_menu) {
          menuToggle.setAttribute("aria-label", copy.nav_menu);
        }

        document.querySelectorAll(".lang-btn").forEach(function (btn) {
          const isActive = btn.dataset.lang === selected;
          btn.classList.toggle("active", isActive);
          btn.setAttribute("aria-pressed", String(isActive));
        });

        const canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink) canonicalLink.setAttribute("href", langUrl(selected));
        const ogUrlMeta = document.querySelector('meta[property="og:url"]');
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

      const header = document.querySelector("header");
      const menuToggle = document.querySelector(".menu-toggle");
      const miniNav = document.querySelector(".mini-nav");
      if (miniNav) miniNav.id = "mobile-site-nav";

      function closeMenu() {
        if (!header || !menuToggle) return;
        header.classList.remove("menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
        setMobileCtaHidden(false);
      }

      const mobileCtaBar = document.querySelector(".mobile-cta-bar");
      let lastScrollY = 0;

      function setMobileCtaHidden(hidden) {
        if (!mobileCtaBar) return;
        mobileCtaBar.classList.toggle("is-hidden", hidden);
      }

      if (menuToggle && header) {
        menuToggle.addEventListener("click", function () {
          const isOpen = header.classList.toggle("menu-open");
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

      const faqItems = Array.from(document.querySelectorAll(".faq-item"));
      faqItems.forEach(function (item) {
        const toggle = item.querySelector(".faq-toggle");
        if (!toggle) return;
        toggle.addEventListener("click", function () {
          const shouldOpen = !item.classList.contains("is-open");
          faqItems.forEach(function (other) {
            other.classList.remove("is-open");
            const otherToggle = other.querySelector(".faq-toggle");
            if (otherToggle) otherToggle.setAttribute("aria-expanded", "false");
          });
          if (!shouldOpen) return;
          item.classList.add("is-open");
          toggle.setAttribute("aria-expanded", "true");
        });
      });

      const serviceCards = Array.from(document.querySelectorAll(".service-card--collapsible"));

      function syncServiceCards() {
        const isMobile = globalThis.innerWidth <= 760;
        serviceCards.forEach(function (card) {
          const toggle = card.querySelector(".service-toggle");
          const body = card.querySelector(".service-card-body");
          if (!toggle || !body) return;

          if (!isMobile) {
            body.hidden = false;
            toggle.setAttribute("aria-expanded", "true");
            return;
          }

          const isOpen = card.classList.contains("is-open");
          body.hidden = !isOpen;
          toggle.setAttribute("aria-expanded", String(isOpen));
        });
      }

      serviceCards.forEach(function (card) {
        const toggle = card.querySelector(".service-toggle");
        if (!toggle) return;
        toggle.addEventListener("click", function () {
          if (globalThis.innerWidth > 760) return;
          const shouldOpen = !card.classList.contains("is-open");
          serviceCards.forEach(function (other) {
            other.classList.remove("is-open");
          });
          if (shouldOpen) card.classList.add("is-open");
          syncServiceCards();
        });
      });

      syncServiceCards();

      const pricingWhyBlock = document.querySelector(".pricing-why-block");
      const pricingWhyToggle = pricingWhyBlock?.querySelector(".pricing-why-toggle");
      const pricingWhyBody = pricingWhyBlock?.querySelector(".pricing-explain");

      function syncPricingWhy() {
        if (!pricingWhyBlock || !pricingWhyToggle || !pricingWhyBody) return;
        const isMobile = globalThis.innerWidth <= 760;
        if (!isMobile) {
          pricingWhyBody.hidden = false;
          pricingWhyToggle.setAttribute("aria-expanded", "true");
          return;
        }
        const isOpen = pricingWhyBlock.classList.contains("is-open");
        pricingWhyBody.hidden = !isOpen;
        pricingWhyToggle.setAttribute("aria-expanded", String(isOpen));
      }

      if (pricingWhyToggle) {
        pricingWhyToggle.addEventListener("click", function () {
          if (globalThis.innerWidth > 760) return;
          pricingWhyBlock.classList.toggle("is-open");
          syncPricingWhy();
        });
      }

      syncPricingWhy();

      globalThis.addEventListener("resize", function () {
        if (globalThis.innerWidth > 760) closeMenu();
        applyLanguage(document.documentElement.lang || fallbackLanguage);
        syncServiceCards();
        syncPricingWhy();
      });

      globalThis.addEventListener("scroll", function () {
        if (!mobileCtaBar || globalThis.innerWidth > 760) return;
        const currentY = globalThis.scrollY || 0;
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
        if (event.key === "Escape" && header?.classList.contains("menu-open")) closeMenu();
      });

      // Theme toggle
      const themeToggleBtn = document.getElementById('theme-toggle-btn');
      let currentTheme = null;
      try {
        currentTheme = localStorage.getItem('rc-theme');
      } catch (error) {
        console.debug("Theme preference read is unavailable", error);
      }
      // Split out of setTheme: re-rendering a third-party widget is its own concern,
      // and keeping it inline pushed setTheme over the cognitive-complexity limit.
      function syncCaptchaTheme(theme) {
        const hc = document.querySelector('.h-captcha');
        if (!hc) return;
        const hcTheme = theme === 'light' ? 'light' : 'dark';
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
          const isLight = document.documentElement.dataset.theme === 'light';
          setTheme(isLight ? 'dark' : 'light');
        });
      }

      const urlLanguage = getLangFromUrl();
      let savedLanguage = null;
      try {
        savedLanguage = localStorage.getItem("preferred-language");
      } catch (error) {
        console.debug("Preferred-language read is unavailable", error);
      }
      let initialLanguage = urlLanguage || savedLanguage || "lv";
      if (!languageFiles[initialLanguage]) initialLanguage = "lv";
      // Pin hCaptcha's language to the site language (not the browser locale)
      // before Web3Forms' async script renders the widget.
      const hcaptchaEl = document.querySelector(".h-captcha");
      if (hcaptchaEl) hcaptchaEl.dataset.hl = initialLanguage;
      applyLanguage(initialLanguage);

      const isOwnerView = isOwnerCounterEnabled();
      setVisitorCounterVisible(isOwnerView);
      updateUniqueVisitorCount();

      (function initContactForm() {
        const form = document.getElementById("contact-form");
        const status = document.getElementById("contact-status");
        if (!form || !status) return;
        const submitBtn = form.querySelector('button[type="submit"]');

        function t(key, fallback) {
          const copy = globalThis.rcCopy;
          return (copy?.[key]) || fallback;
        }

        const CONTACT_EMAIL = "latvia.robotics@gmail.com";
        function showError() {
          status.className = "rc-form-status is-error";
          const msg = t("contact_error", "Something went wrong sending that. Please try again, or {email}.");
          const link = '<a href="mailto:' + CONTACT_EMAIL + '">' + t("contact_error_link", "email me directly") + '</a>';
          if (msg.includes("{email}")) {
            status.innerHTML = msg.replace("{email}", link);
          } else {
            status.textContent = msg;
          }
        }

        const whatsappLink = document.getElementById("whatsapp-contact-link");
        if (whatsappLink) {
          whatsappLink.addEventListener("click", function () {
            rcTrack("Contact", { method: "whatsapp" }, { gaEvent: "generate_lead" });
          });
        }

        const phoneLink = document.getElementById("phone-contact-link");
        if (phoneLink) {
          phoneLink.addEventListener("click", function () {
            rcTrack("Contact", { method: "phone" }, { gaEvent: "generate_lead" });
          });
        }

        form.addEventListener("submit", function (event) {
          event.preventDefault();
          status.className = "rc-form-status";
          status.textContent = "";

          const accessKey = form.querySelector('input[name="access_key"]');
          if (!accessKey?.value || accessKey.value === "YOUR_WEB3FORMS_ACCESS_KEY") {
            showError();
            return;
          }

          const hcaptchaField = form.querySelector('textarea[name="h-captcha-response"]');
          if (hcaptchaField && !hcaptchaField.value) {
            status.className = "rc-form-status is-error";
            status.textContent = t("contact_turnstile", "Please complete the verification and try again.");
            return;
          }

          const originalLabel = submitBtn ? submitBtn.textContent : "";
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
              if (data?.success) {
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
        const cards = document.querySelectorAll(".frame-reveal");
        if (!cards.length) return;
        const reduceMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

        function sizeFrame(card) {
          const svg = card.querySelector(".frame-reveal-svg");
          const rect = svg?.querySelector("rect");
          if (!rect) return;
          const w = card.clientWidth;
          const h = card.clientHeight;
          svg.setAttribute("viewBox", "0 0 " + w + " " + h);
          const inset = 1;
          rect.setAttribute("x", inset);
          rect.setAttribute("y", inset);
          rect.setAttribute("width", Math.max(0, w - inset * 2));
          rect.setAttribute("height", Math.max(0, h - inset * 2));
          rect.setAttribute("rx", Number.parseFloat(getComputedStyle(card).borderTopLeftRadius) || 20);
          rect.style.setProperty("--dash-length", rect.getTotalLength());
        }

        cards.forEach(sizeFrame);

        if (typeof ResizeObserver === "function") {
          const resizeObserver = new ResizeObserver(function (entries) {
            entries.forEach(function (entry) { sizeFrame(entry.target); });
          });
          cards.forEach(function (card) { resizeObserver.observe(card); });
        }

        if (reduceMotion) {
          cards.forEach(function (card) { card.classList.add("in-view"); });
          return;
        }

        const frameObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("in-view");
            frameObserver.unobserve(entry.target);
          });
        }, { threshold: 0.2, rootMargin: "0px 0px -6% 0px" });
        cards.forEach(function (card) { frameObserver.observe(card); });
      })();

      (function initContactButtonsReveal() {
        const contactRect = document.querySelector("#contact.frame-reveal .frame-reveal-svg rect");
        const callLink = document.getElementById("phone-contact-link");
        const waLink = document.getElementById("whatsapp-contact-link");
        if (!contactRect || !callLink || !waLink) return;
        if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        function sizeButtonOutline(link) {
          const svg = link.querySelector(".btn-outline-svg");
          const rect = svg?.querySelector("rect");
          if (!rect) return;
          const w = link.clientWidth;
          const h = link.clientHeight;
          svg.setAttribute("viewBox", "0 0 " + w + " " + h);
          const inset = 1;
          rect.setAttribute("x", inset);
          rect.setAttribute("y", inset);
          rect.setAttribute("width", Math.max(0, w - inset * 2));
          rect.setAttribute("height", Math.max(0, h - inset * 2));
          rect.setAttribute("rx", Number.parseFloat(getComputedStyle(link).borderRadius) || 11);
          rect.style.setProperty("--dash-length", rect.getTotalLength());
        }

        [callLink, waLink].forEach(sizeButtonOutline);
        if (typeof ResizeObserver === "function") {
          const buttonResizeObserver = new ResizeObserver(function (entries) {
            entries.forEach(function (entry) { sizeButtonOutline(entry.target); });
          });
          buttonResizeObserver.observe(callLink);
          buttonResizeObserver.observe(waLink);
        }

        const HIGHLIGHT_PAUSE_MS = 700;

        function wait(ms) {
          return new Promise(function (resolve) { setTimeout(resolve, ms); });
        }

        // Each rect only ever carries the one frameDraw keyframe from CSS, so
        // any animationend on it *is* that draw finishing — no need to filter
        // by animationName or target.
        function waitForAnimationEnd(el) {
          return new Promise(function (resolve) {
            el.addEventListener("animationend", resolve, { once: true });
          });
        }

        // Draws the button's outline, waits for it to finish, holds briefly,
        // then drops the highlight — resolves only after the class is removed
        // so callers can chain the next button's draw right after.
        function drawOutline(link) {
          const rect = link.querySelector(".btn-outline-svg rect");
          link.classList.add("btn-outline-draw");
          return waitForAnimationEnd(rect)
            .then(function () { return wait(HIGHLIGHT_PAUSE_MS); })
            .then(function () { link.classList.remove("btn-outline-draw"); });
        }

        function onContactFrameDrawn() {
          drawOutline(callLink).then(function () { return drawOutline(waLink); });
        }
        contactRect.addEventListener("animationend", onContactFrameDrawn, { once: true });
      })();

      if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const revealNodes = document.querySelectorAll(".reveal");
      const observer = new IntersectionObserver(function (entries) {
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

    // Engagement funnel: PageView -> Scroll50 -> ViewContent -> ContactIntentClick/
    // PrototypesClick/CvClick/DemoOpen/FormStart -> Lead.
    // Without these middle steps there is no way to tell "visitors never reach the
    // form" from "they reach it and don't want it" — opposite problems.
    //
    // Deliberately its own IIFE *after* the main one: the block above returns early
    // for reduced-motion users, and keeping this separate also means a failure here
    // can never take down the contact form's setup, which runs earlier.
    (function initEngagementTracking() {
      const fired = {};

      function once(key, name, params, opts) {
        if (fired[key]) return;
        fired[key] = true;
        rcTrack(name, params, opts);
      }

      function onScroll() {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - globalThis.innerHeight;
        if (scrollable <= 0) return;
        if ((doc.scrollTop || document.body.scrollTop) / scrollable >= 0.5) {
          once("scroll50", "Scroll50", undefined, { custom: true });
          globalThis.removeEventListener("scroll", onScroll);
        }
      }
      globalThis.addEventListener("scroll", onScroll, { passive: true });

      // Two separate ViewContent targets, because they answer different questions:
      // "about" tells us whether the credibility block (name, track record, honest
      // project status) is actually reached — the core bet of the current landing —
      // while "contact" tells us whether people get as far as the form.
      function observeSection(id, key, contentName) {
        const section = document.getElementById(id);
        if (!section || typeof IntersectionObserver !== "function") return;
        const sectionObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            once(key, "ViewContent", { content_name: contentName });
            sectionObserver.unobserve(entry.target);
          });
        }, { threshold: 0.3 });
        sectionObserver.observe(section);
      }

      observeSection("about", "viewAbout", "about-section");
      observeSection("contact", "viewContact", "contact-section");

      const contactForm = document.getElementById("contact-form");
      if (contactForm) {
        contactForm.addEventListener("focusin", function (event) {
          // The Zvaniet / WhatsApp links sit inside <form> for layout reasons, and
          // focusing a link is not "started filling the form" — without this guard
          // every phone/WhatsApp click also fired FormStart and inflated the funnel.
          if (!event.target.matches("input, textarea, select")) return;
          once("formStart", "FormStart", undefined, { custom: true });
        });
      }

      document.addEventListener("click", function (event) {
        const node = event.target;
        if (!node || typeof node.closest !== "function") return;
        const link = node.closest("a, button");
        if (!link) return;

        // Clicking through to the full CV means someone is checking who they'd be
        // hiring — the strongest intent signal on the page short of contacting.
        if (link.id === "about-cv-link") {
          once("cvClick", "CvClick", undefined, { custom: true, gaEvent: "select_content" });
          return;
        }

        // The demo link now opens the live server directly (no contact-form
        // gate) — a dedicated event so the funnel shows how many people
        // actually opened it, distinct from the generic CTAClick bucket.
        if (link.id === "demo-cta-link") {
          once("demoOpen", "DemoOpen", undefined, { custom: true, gaEvent: "select_content" });
          return;
        }

        // "Skatīt, ko es daru" is the only hero CTA pointing away from the
        // contact form — someone wanting to see the portfolio, not to talk yet.
        if (link.id === "hero-cta-alt") {
          once("prototypesClick", "PrototypesClick", undefined, { custom: true, gaEvent: "select_content" });
          return;
        }

        // Same "Rakstiet man" intent shows up in three places (hero, mid-page
        // CTA, sticky mobile bar) — one event, not three, since it's one
        // signal (wants to contact) regardless of which copy triggered it.
        if (link.id === "hero-cta-main" || link.id === "cta-mid-btn" || link.id === "mobile-cta-bar-btn") {
          once("contactIntent", "ContactIntentClick", { source: link.id },
               { custom: true, gaEvent: "select_content" });
        }
      });
    })();
