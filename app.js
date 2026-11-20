render(); restoreDraft(); if (startupError) $('error').textContent = startupError;
setInterval(renderTimer, 250);
showView(location.hash.slice(1) || 'game');
// Keep entered, unsaved hand values with their own session as well.
for (const id of ['scoreA', 'scoreB']) $(id).addEventListener('input', scheduleScoreValidation);
for (const id of ['scoreA', 'scoreB', 'note']) {
  $(id).addEventListener('input', persist);
  $(id).addEventListener('change', persist);
}
document.querySelectorAll('.adjustments button').forEach(button => button.addEventListener('click', persist));
if (!startupError) persist();
if (freshSession) openSessionSetup();
