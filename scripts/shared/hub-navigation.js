/**
 * Universal Official Hub Navigation Widget
 * Provides seamless return-to-hub navigation and a floating quick-switcher
 * across Fee Collection, Result Management, and Admin pages without session loss.
 */
(() => {
  const currentPath = window.location.pathname.toLowerCase();
  const isOfficialHub = currentPath.includes('official.html');
  if (isOfficialHub) return; // Not needed on hub itself

  const injectHubNavigation = () => {
    // 1. Floating Quick-Switcher
    if (!document.getElementById('hub-floating-switcher')) {
      const switcher = document.createElement('div');
      switcher.id = 'hub-floating-switcher';
      switcher.className = 'fixed bottom-5 right-5 z-[4500] no-print transition-all duration-300';
      switcher.innerHTML = `
        <a href="official.html" class="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-900/95 hover:bg-black text-white rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 group text-xs font-bold" title="Return to Official Portal Hub">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <i class="fas fa-th-large text-blue-400 text-sm group-hover:rotate-6 transition-transform"></i>
          <span>Official Hub</span>
          <i class="fas fa-arrow-right text-[10px] text-slate-400"></i>
        </a>
      `;
      document.body.appendChild(switcher);
    }

    // 2. Add Top-Bar "Official Hub" button in collection.html & result.html if not already present
    const headerContainer = document.querySelector('.nav-container');
    const mobileToggle = document.querySelector('.mobile-toggle');
    if (headerContainer && mobileToggle && !document.getElementById('topbar-hub-link')) {
      const hubBtn = document.createElement('a');
      hubBtn.id = 'topbar-hub-link';
      hubBtn.href = 'official.html';
      hubBtn.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-all mr-2';
      hubBtn.title = 'Back to Official Hub';
      hubBtn.innerHTML = '<i class="fas fa-th-large text-blue-600"></i><span>Official Hub</span>';
      headerContainer.insertBefore(hubBtn, mobileToggle);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHubNavigation);
  } else {
    injectHubNavigation();
  }
})();
