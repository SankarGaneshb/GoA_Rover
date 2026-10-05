/**
 * GoA_Rover - Popup Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['minutesSaved', 'totalXP', 'level'], (data) => {
    const mins = data.minutesSaved || 0;
    const dollars = (mins * (80 / 60)).toFixed(2);
    const xp = data.totalXP || 0;
    const lvl = data.level || 'Lvl 1 Scout';

    const elRoi = document.getElementById('val-roi');
    if (elRoi) elRoi.textContent = `⚡ ${mins}m saved ($${dollars})`;

    const elXp = document.getElementById('val-xp');
    if (elXp) elXp.textContent = `${lvl} (${xp} XP)`;
  });

  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      chrome.storage.local.get(['minutesSaved', 'totalXP'], (data) => {
        const mins = data.minutesSaved || 0;
        const report = `# GoA_Rover Daily Standup Report\n- **Minutes Saved**: ${mins} mins\n- **Value Unlocked**: $${(mins * (80/60)).toFixed(2)}\n- **Total XP Earned**: ${data.totalXP || 0} XP\n- Generated on: ${new Date().toLocaleString()}`;
        navigator.clipboard.writeText(report).then(() => {
          alert('Report copied to clipboard!');
        });
      });
    });
  }
});
