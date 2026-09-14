export class CanvasAccessibleTwin {
  constructor({ canvasElement, onObjectSelected }) {
    this.canvas = canvasElement;
    this.onObjectSelected = onObjectSelected;
    this.entities = new Map();
    this.container = document.createElement("div");
    this.container.id = "canvas-accessible-twin";
    this.container.style.cssText = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0";
    this.liveRegion = document.createElement("div");
    this.liveRegion.setAttribute("role", "status");
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");
    this.container.appendChild(this.liveRegion);
    canvasElement.parentNode.insertBefore(this.container, canvasElement.nextSibling);
  }

  registerEntity({ id, label, mesh, onActivate }) {
    if (this.entities.has(id)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.addEventListener("focus", () => {
      if (mesh?.userData) mesh.userData.hasA11yFocus = true;
    });
    button.addEventListener("blur", () => {
      if (mesh?.userData) mesh.userData.hasA11yFocus = false;
    });
    button.addEventListener("click", () => {
      onActivate?.();
      this.onObjectSelected?.(id);
    });
    this.container.appendChild(button);
    this.entities.set(id, { button, mesh });
  }

  announce(message) {
    this.liveRegion.textContent = "";
    requestAnimationFrame(() => {
      this.liveRegion.textContent = message;
    });
  }

  destroy() {
    this.container.remove();
    this.entities.clear();
  }
}
