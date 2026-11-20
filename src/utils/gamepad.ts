export interface GamepadInputState {
  connected: boolean;
  name: string | null;
  moveX: number;
  moveY: number;
  kickDown: boolean;
  pauseDown: boolean;
}

export function getConnectedGamepad(padIndex = 0): Gamepad | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return null;
  }
  const pads = navigator.getGamepads();
  const connected: Gamepad[] = [];
  for (let i = 0; i < pads.length; i++) {
    const gp = pads[i];
    if (gp && gp.connected) {
      connected.push(gp);
    }
  }
  return connected[padIndex] || null;
}

export function pollGamepadInput(padIndex = 0): GamepadInputState {
  const gp = getConnectedGamepad(padIndex);
  if (!gp) {
    return {
      connected: false,
      name: null,
      moveX: 0,
      moveY: 0,
      kickDown: false,
      pauseDown: false,
    };
  }

  const deadzone = 0.18;
  let ax = gp.axes[0] ?? 0;
  let ay = gp.axes[1] ?? 0;
  if (Math.abs(ax) < deadzone) ax = 0;
  if (Math.abs(ay) < deadzone) ay = 0;

  // D-Pad fallback (Standard Gamepad buttons 12=Up, 13=Down, 14=Left, 15=Right)
  if (gp.buttons[14]?.pressed) ax = -1;
  if (gp.buttons[15]?.pressed) ax = 1;
  if (gp.buttons[12]?.pressed) ay = -1;
  if (gp.buttons[13]?.pressed) ay = 1;

  const mag = Math.hypot(ax, ay);
  if (mag > 1) {
    ax /= mag;
    ay /= mag;
  }

  // Standard kick buttons: A/Cross (0), B/Circle (1), X/Square (2), RB/R1 (5), RT/R2 (7)
  const kickDown = Boolean(
    gp.buttons[0]?.pressed ||
      gp.buttons[1]?.pressed ||
      gp.buttons[2]?.pressed ||
      gp.buttons[5]?.pressed ||
      gp.buttons[7]?.pressed
  );

  const pauseDown = Boolean(gp.buttons[9]?.pressed);

  return {
    connected: true,
    name: gp.id,
    moveX: ax,
    moveY: ay,
    kickDown,
    pauseDown,
  };
}
