// Phone presentation only. Entries, imports and accounting stay in the main app.
(() => {
  const phone = window.matchMedia('(max-width: 740px)');
  const icons = {
    daybook: '<path d="M5 3h14v18H5zM9 7h6M9 11h6M9 15h4"/>',
    payments: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/>',
    rooms: '<path d="M4 21V3h12v18M2 21h20M16 9h4v12M8 7h4M8 11h4M8 21v-6h4v6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
  const nav = document.createElement('nav');
  nav.className = 'phone-nav';
  nav.setAttribute('aria-label', 'Main navigation');
  nav.innerHTML = [['daybook', 'Day Book'], ['payments', 'Payments'], ['rooms', 'Rooms']].map(([name, label]) => '<button type="button" data-phone-page="' + name + '">' + icon(name) + '<span>' + label + '</span></button>').join('') + '<button type="button" data-phone-more aria-haspopup="dialog" aria-controls="phoneMore">' + icon('more') + '<span>More</span></button>';
  document.body.append(nav);

  const menuButton = document.createElement('button');
  menuButton.className = 'phone-menu-button';
  menuButton.type = 'button';
  menuButton.setAttribute('aria-label', 'Open menu and account actions');
  menuButton.setAttribute('aria-haspopup', 'dialog');
  menuButton.setAttribute('aria-controls', 'phoneMore');
  menuButton.innerHTML = icon('menu');
  document.querySelector('.top').append(menuButton);

  const menu = document.createElement('dialog');
  menu.id = 'phoneMore';
  menu.setAttribute('aria-labelledby', 'phoneMoreTitle');
  menu.innerHTML = '<div class="phone-menu-head"><div><p>The Himalayan Regency</p><h2 id="phoneMoreTitle">More</h2></div><button type="button" class="phone-menu-close" aria-label="Close menu">' + icon('close') + '</button></div><div class="phone-menu-pages"><button type="button" data-phone-page="cars"><b>Car Rounds</b><span>Vehicle expenses and travel dates</span></button><button type="button" data-phone-page="reports"><b>Reports &amp; Hisaab</b><span>Financial summary and date ranges</span></button><button type="button" data-phone-page="import"><b>Import Day Book</b><span>Upload or paste Day Book JSON</span></button></div><div class="phone-menu-account"><h3>Account</h3><button type="button" data-phone-action="refreshCloud">Refresh cloud data</button><button type="button" data-phone-action="export">Download backup</button><button type="button" data-phone-action="signout">Sign out</button></div>';
  document.body.append(menu);
  const openMenu = () => {
    if (!phone.matches || menu.open) return;
    menu.showModal();
    document.body.classList.add('phone-menu-open');
  };
  menuButton.addEventListener('click', openMenu);
  nav.querySelector('[data-phone-more]').addEventListener('click', openMenu);
  menu.querySelector('.phone-menu-close').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => document.body.classList.remove('phone-menu-open'));
  menu.addEventListener('click', event => {
    if (event.target !== menu) return;
    const rect = menu.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) menu.close();
  });
  phone.addEventListener('change', () => { if (!phone.matches && menu.open) menu.close(); });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-phone-page], [data-phone-action]');
    if (!button) return;
    if (menu.open) menu.close();
    if (button.dataset.phoneAction) {
      document.getElementById(button.dataset.phoneAction)?.click();
      return;
    }
    const name = button.dataset.phonePage;
    document.querySelector('#sidenav [data-page="' + name + '"]')?.click();
    window.scrollTo({ top: 0, behavior: 'instant' });
    const heading = document.getElementById('title');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  });

  const tableKinds = {
    inRows: 'entries', outRows: 'entries', paymentRows: 'payments',
    roomSummaryRows: 'room-summary', roomRegisterRows: 'room-register',
    carSummary: 'car-summary', carRows: 'car-register',
    paymentDailyRows: 'payment-history', reportRows: 'report', expenseRows: 'expenses',
    importRows: 'import', paymentImportRows: 'payment-import'
  };
  function updatePhonePresentation() {
    const active = document.querySelector('main > .view.active')?.id || 'daybook';
    nav.querySelectorAll('button').forEach(button => {
      const selected = button.dataset.phonePage ? button.dataset.phonePage === active : !['daybook', 'payments', 'rooms'].includes(active);
      button.classList.toggle('selected', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('#payments [data-payment-view]').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));
    for (const [id, kind] of Object.entries(tableKinds)) {
      const body = document.getElementById(id), table = body?.closest('table');
      if (!table) continue;
      table.dataset.phoneTable = kind;
      const headings = Array.from(table.tHead?.rows[0]?.cells || []).map(cell => cell.textContent.trim());
      for (const row of [...body.rows, ...Array.from(table.tFoot?.rows || [])]) {
        let column = 0;
        for (const cell of row.cells) {
          cell.dataset.label = headings[column] || '';
          column += cell.colSpan;
        }
      }
      if (id === 'roomSummaryRows' && table.tFoot?.rows[0]) {
        table.tFoot.rows[0].cells[0].dataset.label = '';
        table.tFoot.rows[0].cells[4].dataset.label = 'Rooms / Blocks';
      }
    }
  }
  let scheduled = false;
  const observer = new MutationObserver(records => {
    if (scheduled || !records.some(record => record.type === 'childList' || record.target.matches('main > .view'))) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; updatePhonePresentation(); });
  });
  observer.observe(document.querySelector('main'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  updatePhonePresentation();
})();
