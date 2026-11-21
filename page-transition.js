(() => {
  const documentRoot = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sharedStyles = /(?:^|\/)(?:topbar|page-transition|mobile|responsive)\.css(?:[?#]|$)/i;
  const sharedScripts = /(?:^|\/)(?:page-transition)\.js(?:[?#]|$)/i;
  const homeRuntime = /(?:^|\/)(?:app|leensfish-ocean)\.js(?:[?#]|$)/i;
  let navigating = false;
  let loadingStartedAt = 0;
  let loadingEndTimer = null;
  let loadingShowTimer = null;

  function persistLanguageChoice(link) {
    const language = link?.dataset.languageChoice?.toLowerCase();
    if (language !== 'es' && language !== 'en') return;

    try {
      window.localStorage.setItem('alcanox_language', language);
    } catch (error) {
    }

    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `alcanox_language=${language}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }

  function getRouteLoader() {
    let loader = document.getElementById('siteRouteLoader');
    if (loader) return loader;

    loader = document.createElement('div');
    loader.id = 'siteRouteLoader';
    loader.className = 'site-route-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.setAttribute('aria-label', 'Cargando página');
    loader.innerHTML = '<span class="site-route-loader-spinner" aria-hidden="true"></span>';
    document.body.appendChild(loader);
    return loader;
  }

  function startRouteLoading() {
    window.clearTimeout(loadingEndTimer);
    window.clearTimeout(loadingShowTimer);
    loadingStartedAt = Date.now();
    getRouteLoader();
    documentRoot.classList.add('route-loading');
    documentRoot.classList.remove('route-loading-visible');
    document.body.setAttribute('aria-busy', 'true');
    loadingShowTimer = window.setTimeout(() => {
      documentRoot.classList.add('route-loading-visible');
    }, 90);
  }

  function stopRouteLoading() {
    const elapsed = Date.now() - loadingStartedAt;
    const delay = Math.max(0, 80 - elapsed);
    window.clearTimeout(loadingEndTimer);
    window.clearTimeout(loadingShowTimer);
    loadingEndTimer = window.setTimeout(() => {
      documentRoot.classList.remove('route-loading');
      documentRoot.classList.remove('route-loading-visible');
      document.body.removeAttribute('aria-busy');
    }, delay);
  }

  function resetMenuState(header = document.getElementById('siteHeader')) {
    const menuToggle = header?.querySelector('#menuToggle');
    const primaryNav = header?.querySelector('#primaryNav');
    menuToggle?.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    primaryNav?.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  }

  function normalizeToolbar(header = document.getElementById('siteHeader')) {
    if (!header) return;

    header.classList.add('is-scrolled');
    header.classList.remove('is-hidden');

    const menuToggle = header.querySelector('#menuToggle');
    const primaryNav = header.querySelector('#primaryNav');
    if (!menuToggle || !primaryNav) return;

    resetMenuState(header);

    if (menuToggle.dataset.alcanoxToolbarBound === 'true') return;
    menuToggle.dataset.alcanoxToolbarBound = 'true';

    const closeMenu = () => {
      menuToggle.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      primaryNav.classList.remove('is-open');
      document.body.classList.remove('menu-open');
    };

    menuToggle.addEventListener('click', () => {
      const opened = primaryNav.classList.toggle('is-open');
      menuToggle.classList.toggle('is-open', opened);
      menuToggle.setAttribute('aria-expanded', String(opened));
      document.body.classList.toggle('menu-open', opened);
    });

    primaryNav.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    document.addEventListener('click', (event) => {
      if (primaryNav.classList.contains('is-open') && !header.contains(event.target)) {
        closeMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1060) closeMenu();
    });
  }

  function normalizeRoutePath(pathname = '/') {
    let path = String(pathname || '/').toLowerCase();
    path = path.replace(/\/index(?:-[a-z]+)?\.html?$/, '/');
    path = path.replace(/\/{2,}/g, '/');
    if (!path.startsWith('/')) path = `/${path}`;
    if (!path.endsWith('/')) path += '/';
    return path;
  }

  function syncActiveRoute(header = document.getElementById('siteHeader'), currentUrl = window.location.href) {
    if (!header) return;

    const destination = currentUrl instanceof URL
      ? currentUrl
      : new URL(currentUrl, window.location.href);
    const currentPath = normalizeRoutePath(destination.pathname);
    const primaryNav = header.querySelector('#primaryNav');

    primaryNav?.querySelectorAll('a[href]').forEach((link) => {
      const linkUrl = new URL(link.href, destination.href);
      const isCurrent = linkUrl.origin === destination.origin
        && normalizeRoutePath(linkUrl.pathname) === currentPath;
      if (isCurrent) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    const contactCta = header.querySelector('.header-cta');
    if (contactCta?.href) {
      const ctaUrl = new URL(contactCta.href, destination.href);
      const isContact = ctaUrl.origin === destination.origin
        && normalizeRoutePath(ctaUrl.pathname) === currentPath;
      if (isContact) contactCta.setAttribute('aria-current', 'page');
      else contactCta.removeAttribute('aria-current');
    }

    const currentLocale = currentPath.match(/^\/(en|es)(?:\/|$)/)?.[1];
    header.querySelector('.language-switcher')?.querySelectorAll('a[href]').forEach((link) => {
      const linkUrl = new URL(link.href, destination.href);
      const linkLocale = linkUrl.pathname.toLowerCase().match(/^\/(en|es)(?:\/|$)/)?.[1];
      if (currentLocale && linkLocale === currentLocale) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function showPage() {
    documentRoot.classList.remove('page-leaving');
    documentRoot.classList.add('page-ready');
  }

  function isSitePage(url) {
    if (url.origin !== window.location.origin) return false;

    const pathname = url.pathname.toLowerCase();
    const lastSegment = pathname.split('/').pop() || '';
    return pathname.endsWith('/') || lastSegment.endsWith('.html') || !lastSegment.includes('.');
  }

  function resolveLocalDirectoryIndex(url) {
    if (url.protocol !== 'file:' || !url.pathname.endsWith('/')) return url;
    const resolved = new URL(url.href);
    resolved.pathname += 'index.html';
    return resolved;
  }

  function markInitialRouteAssets() {
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      if (!sharedStyles.test(link.href)) link.dataset.routeStyle = 'true';
    });
    document.querySelectorAll('script[src]').forEach((script) => {
      if (!sharedScripts.test(script.src)) script.dataset.routeScript = 'true';
    });
  }

  function isSharedStylesheet(link) {
    const value = link.getAttribute('href') || link.href || '';
    return sharedStyles.test(value) || /^https?:\/\/fonts\.(?:googleapis|gstatic)\.com\//i.test(value);
  }

  function waitForStylesheet(link) {
    try {
      if (link.sheet) return Promise.resolve();
    } catch (error) {
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        link.removeEventListener('load', finish);
        link.removeEventListener('error', finish);
        window.clearTimeout(timeout);
        resolve();
      };
      const timeout = window.setTimeout(finish, 700);
      link.addEventListener('load', finish, { once: true });
      link.addEventListener('error', finish, { once: true });
    });
  }

  async function waitForRouteVisuals() {
    const fontsReady = document.fonts?.ready
      ? document.fonts.ready.catch(() => undefined)
      : Promise.resolve();

    await Promise.race([
      fontsReady,
      new Promise((resolve) => window.setTimeout(resolve, 80)),
    ]);
  }

  async function syncHead(targetDocument, destination) {
    document.title = targetDocument.title;
    documentRoot.lang = targetDocument.documentElement.lang || documentRoot.lang;
    if (targetDocument.documentElement.dataset.siteRoot) {
      documentRoot.dataset.siteRoot = targetDocument.documentElement.dataset.siteRoot;
    }

    targetDocument.head.querySelectorAll('meta[name], meta[property]').forEach((incoming) => {
      const key = incoming.getAttribute('name') || incoming.getAttribute('property');
      const selector = incoming.hasAttribute('name')
        ? `meta[name="${CSS.escape(key)}"]`
        : `meta[property="${CSS.escape(key)}"]`;
      const current = document.head.querySelector(selector);
      if (current && incoming.hasAttribute('content')) current.setAttribute('content', incoming.getAttribute('content'));
    });

    const activeRouteStyles = [];
    const targetStyles = Array.from(targetDocument.head.querySelectorAll('link[rel="stylesheet"]'));

    const pendingStyles = [];
    for (const incoming of targetStyles) {
      const href = new URL(incoming.getAttribute('href'), destination.href).href;
      let link = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
        .find((candidate) => candidate.href === href);
      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        if (!isSharedStylesheet(incoming)) link.dataset.routeStyle = 'true';
        document.head.appendChild(link);
        pendingStyles.push(waitForStylesheet(link));
      }
      if (!isSharedStylesheet(incoming)) activeRouteStyles.push(link);
    }

    if (pendingStyles.length) {
      await Promise.race([
        Promise.all(pendingStyles),
        new Promise((resolve) => window.setTimeout(resolve, 700)),
      ]);
    }

    document.head.querySelectorAll('link[data-route-style]').forEach((link) => {
      if (!activeRouteStyles.includes(link)) link.remove();
    });

  }

  function resolveRouteReferences(node, destination) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

    const elements = [node, ...node.querySelectorAll('[href], [src], [srcset], [poster], [action], [formaction]')];
    elements.forEach((element) => {
      ['href', 'src', 'poster', 'action', 'formaction'].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (!value) return;
        element.setAttribute(attribute, new URL(value, destination.href).href);
      });

      const srcset = element.getAttribute('srcset');
      if (!srcset) return;
      const rewritten = srcset.split(',').map((candidate) => {
        const parts = candidate.trim().split(/\s+/);
        if (!parts[0]) return candidate;
        parts[0] = new URL(parts[0], destination.href).href;
        return parts.join(' ');
      }).join(', ');
      element.setAttribute('srcset', rewritten);
    });
  }

  function freezeToolbar(header = document.getElementById('siteHeader')) {
    if (!header || header.dataset.alcanoxToolbarFrozen === 'true') return;

    header.querySelectorAll('a[href]').forEach((link) => {
      link.href = new URL(link.getAttribute('href'), window.location.href).href;
      link.removeAttribute('aria-current');
    });
    header.dataset.alcanoxToolbarFrozen = 'true';
  }

  function syncToolbar(currentHeader, currentUrl = window.location.href) {
    if (!currentHeader) return;
    freezeToolbar(currentHeader);
    normalizeToolbar(currentHeader);
    syncActiveRoute(currentHeader, currentUrl);
  }

  function loadRouteScripts(targetDocument, destination) {
    document.querySelectorAll('script[data-route-script]').forEach((script) => script.remove());
    targetDocument.querySelectorAll('script[src]').forEach((incoming) => {
      const scriptUrl = new URL(incoming.getAttribute('src'), destination.href).href;

      if (homeRuntime.test(scriptUrl)) {
        const scriptName = scriptUrl.split('/').pop().split('?')[0];
        const scriptMatcher = new RegExp('(?:^|/)' + scriptName + '(?:[?#]|$)', 'i');
        document.querySelectorAll('script[src]').forEach((script) => {
          if (scriptMatcher.test(script.src)) script.remove();
        });

        const runtime = document.createElement('script');
        runtime.src = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}navigation=${Date.now()}`;
        runtime.async = false;
        runtime.dataset.homeRuntime = 'true';
        document.body.appendChild(runtime);
        return;
      }

      const alreadyLoaded = Array.from(document.querySelectorAll('script[src]')).some((script) => script.src === scriptUrl);
      if (alreadyLoaded) return;
      const script = document.createElement('script');
      script.src = scriptUrl;
      if (!sharedScripts.test(incoming.src)) script.dataset.routeScript = 'true';
      document.body.appendChild(script);
    });

    document.querySelectorAll('script[data-route-inline]').forEach((script) => script.remove());
    targetDocument.querySelectorAll('script:not([src])').forEach((inline) => {
      if (inline.type === 'application/x-alcanox-disabled') return;
      const script = document.createElement('script');
      if (inline.type) script.type = inline.type;
      script.textContent = inline.textContent;
      script.dataset.routeInline = 'true';
      document.body.appendChild(script);
    });
  }

  function mountSharedToolbar() {
    const header = document.getElementById('siteHeader');
    if (!header || header.parentElement?.classList.contains('shared-topbar-shell')) return header;

    const frame = header.closest('.site-shell, .showcase');
    if (!frame || header.parentElement !== frame) return null;

    const sharedShell = document.createElement('div');
    sharedShell.className = 'site-shell shared-topbar-shell';
    frame.parentElement.insertBefore(sharedShell, frame);
    sharedShell.appendChild(header);
    return header;
  }

  function getPageFrame(pageDocument) {
    const main = pageDocument.querySelector('main#contenido');
    const frame = main?.closest('.site-shell, .showcase');
    if (!frame) return null;

    return {
      frame,
      header: pageDocument.querySelector('#siteHeader'),
    };
  }

  async function navigateTo(destination, pushState = true) {
    if (navigating) return;
    navigating = true;
    startRouteLoading();
    resetMenuState();

    try {
      const response = await fetch(destination.href, {
        headers: { Accept: 'text/html' },
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`Route returned ${response.status}`);

      const html = await response.text();
      const targetDocument = new DOMParser().parseFromString(html, 'text/html');
      const current = getPageFrame(document);
      const target = getPageFrame(targetDocument);
      if (!current || !target || !target.header) throw new Error('Route has no persistent site frame');

      await syncHead(targetDocument, destination);

      const incomingNodes = Array.from(target.frame.childNodes)
        .filter((node) => node !== target.header)
        .map((node) => document.importNode(node, true));
      incomingNodes.forEach((node) => resolveRouteReferences(node, destination));

      documentRoot.classList.add('has-route-transition', 'route-entering');

      if (!reducedMotion.matches) {
        await new Promise((resolve) => window.setTimeout(resolve, 140));
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

      current.frame.className = target.frame.className;
      if (target.frame.id) current.frame.id = target.frame.id;
      else current.frame.removeAttribute('id');
      current.frame.replaceChildren(...incomingNodes);
      document.body.className = targetDocument.body.className;
      document.body.classList.add('is-ready');
      resetMenuState(current.header);
      syncToolbar(current.header, destination);
      loadRouteScripts(targetDocument, destination);

      if (pushState) window.history.pushState({}, '', destination.href);
      const hashTarget = destination.hash ? document.querySelector(destination.hash) : null;
      if (hashTarget) hashTarget.scrollIntoView({ behavior: 'auto', block: 'start' });
      showPage();
      await waitForRouteVisuals();

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          documentRoot.classList.remove('route-entering');
          stopRouteLoading();
        });
      });
    } catch (error) {
      resetMenuState();
      documentRoot.classList.remove('route-entering');
      window.location.href = destination.href;
    } finally {
      resetMenuState();
      navigating = false;
    }
  }

  const sharedToolbar = mountSharedToolbar();
  markInitialRouteAssets();
  freezeToolbar(sharedToolbar);
  normalizeToolbar(sharedToolbar);
  syncActiveRoute(sharedToolbar, window.location);
  requestAnimationFrame(showPage);
  window.addEventListener('pageshow', () => {
    resetMenuState();
    normalizeToolbar();
    showPage();
    stopRouteLoading();
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;

    persistLanguageChoice(link);
    if (link.dataset.languageChoice) return;

    const destination = resolveLocalDirectoryIndex(new URL(link.href, window.location.href));
    const isSameDocument = destination.pathname === window.location.pathname && destination.hash;
    if (!isSitePage(destination) || isSameDocument) return;
    event.preventDefault();
    navigateTo(destination);
  });

  window.addEventListener('popstate', () => {
    const destination = new URL(window.location.href);
    if (isSitePage(destination)) navigateTo(destination, false);
  });
})();
