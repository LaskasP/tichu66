// Keep selects as the source of form values, but use the same option sheet on
// every platform instead of opening Safari's system picker.
const syncDropdowns = (() => {
  const dropdowns = new WeakMap();
  const picker = document.createElement('dialog');
  picker.id = 'optionPicker';
  picker.className = 'option-picker';
  picker.setAttribute('aria-labelledby', 'optionPickerTitle');
  picker.innerHTML = '<div class="dialog-heading"><h2 id="optionPickerTitle"></h2><button type="button" class="quiet" aria-label="Close options">Close</button></div><div class="picker-options" role="listbox" aria-labelledby="optionPickerTitle"></div>';
  document.body.append(picker);
  let pickerTrigger;
  picker.querySelector('button').onclick = () => picker.close();
  picker.addEventListener('click', event => {
    if (event.target !== picker) return;
    const bounds = picker.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) picker.close();
  });
  picker.addEventListener('close', () => {
    pickerTrigger?.setAttribute('aria-expanded', 'false');
    if (pickerTrigger?.isConnected && !pickerTrigger.disabled) pickerTrigger.focus();
  });
  function syncDropdowns() {
    document.querySelectorAll('select').forEach(select => {
      let control = dropdowns.get(select);
      if (!control) {
        const label = document.querySelector(`label[for="${select.id}"]`);
        const title = select.getAttribute('aria-label') || (label && [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim()) || 'Choose an option';
        const button = document.createElement('button');
        button.type = 'button';
        button.id = select.id + '-trigger';
        button.className = 'select-trigger';
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-controls', picker.id);
        button.setAttribute('aria-expanded', 'false');
        if (select.hasAttribute('aria-describedby')) button.setAttribute('aria-describedby', select.getAttribute('aria-describedby'));
        if (select.autofocus) { button.autofocus = true; select.autofocus = false; }
        if (label) label.htmlFor = button.id;
        select.hidden = true;
        select.after(button);
        control = { button, title };
        dropdowns.set(select, control);
        button.onclick = () => openDropdown(select, control);
        button.onkeydown = event => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openDropdown(select, control); }
        };
        select.addEventListener('change', syncDropdowns);
      }
      control.button.textContent = select.selectedOptions[0]?.textContent || 'Choose an option';
      control.button.setAttribute('aria-label', `${control.title}: ${control.button.textContent}`);
      control.button.disabled = select.disabled;
    });
  }
  function openDropdown(select, { button, title }) {
    if (select.disabled || picker.open) return;
    pickerTrigger = button;
    $('optionPickerTitle').textContent = title;
    const list = picker.querySelector('.picker-options');
    list.replaceChildren();
    [...select.options].forEach(option => {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'picker-option';
      choice.setAttribute('role', 'option');
      choice.setAttribute('aria-selected', String(option.selected));
      choice.textContent = option.textContent;
      choice.disabled = option.disabled;
      choice.tabIndex = option.selected ? 0 : -1;
      choice.onclick = () => {
        const changed = select.value !== option.value;
        // Close before change handlers can open another dialog or replace controls.
        picker.close();
        if (changed) {
          select.value = option.value;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncDropdowns();
        // Seat changes rebuild the resting-player controls.
        const replacement = document.getElementById(button.id);
        if (replacement && !replacement.disabled) { pickerTrigger = replacement; replacement.focus(); }
      };
      list.append(choice);
    });
    let typed = '', lastKey = 0;
    list.onkeydown = event => {
      const choices = [...list.querySelectorAll('button:not(:disabled)')];
      const index = choices.indexOf(document.activeElement);
      let next;
      if (event.key === 'ArrowDown') next = choices[(index + 1) % choices.length];
      if (event.key === 'ArrowUp') next = choices[(index - 1 + choices.length) % choices.length];
      if (event.key === 'Home') next = choices[0];
      if (event.key === 'End') next = choices.at(-1);
      if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        typed = Date.now() - lastKey > 700 ? event.key : typed + event.key;
        lastKey = Date.now();
        next = choices.find(choice => choice.textContent.trim().toLocaleLowerCase().startsWith(typed.toLocaleLowerCase()));
      }
      if (next) {
        event.preventDefault();
        choices.forEach(choice => { choice.tabIndex = choice === next ? 0 : -1; });
        next.focus();
      }
    };
    button.setAttribute('aria-expanded', 'true');
    picker.showModal();
    (list.querySelector('[aria-selected="true"]:not(:disabled)') || list.querySelector('button:not(:disabled)'))?.focus();
  }

  return syncDropdowns;
})();
