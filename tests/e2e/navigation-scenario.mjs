// Serializable browser workload. The sampling window starts at the first paint
// opportunity; event handling may delay that opportunity on a busy page.
export async function navigationFrames({eventWorkMs = 0} = {}) {
  const fly = document.getElementById('flyout'), motion = document.getElementById('motion'), out = [];
  document.getElementById('trigger').click();
  const blockedUntil = performance.now() + eventWorkMs;
  while (performance.now() < blockedUntil) {} // Synthetic event work, never extension code.
  let until;
  do {
    await new Promise(requestAnimationFrame);
    const now = performance.now();
    until ??= now + 400;
    out.push({bg:getComputedStyle(fly).backgroundColor, h:fly.getBoundingClientRect().height,
      opacity:+getComputedStyle(motion).opacity, width:motion.getBoundingClientRect().width,
      motionBg:getComputedStyle(motion).backgroundColor, t:now,
      transition:getComputedStyle(fly).transition, ink:getComputedStyle(document.getElementById('menuText')).color});
  } while (performance.now() < until);
  return out;
}
