/**
 * Reference Implementation: 3D Canvas Accessible Twin Pattern (WCAG 2.2 Compliant)
 * 
 * Bridges a WebGL/WebGPU 3D canvas with screen readers and keyboard navigation
 * by generating an offscreen semantic HTML accessibility tree with ARIA live regions
 * and projecting focus outlines back into the 3D scene.
 */

export class CanvasAccessibleTwin {
  constructor({ canvasElement, onObjectSelected }) {
    this.canvas = canvasElement;
    this.onObjectSelected = onObjectSelected;
    this.entities = new Map(); // id -> { label, element, mesh }
    
    this.container = this._createTwinContainer();
    this.liveRegion = this._createLiveRegion();
    this.focusedEntityId = null;
  }

  _createTwinContainer() {
    const div = document.createElement('div');
    div.id = 'canvas-accessible-twin';
    // Visually hidden from sighted users, accessible to assistive technologies
    div.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    `;
    this.canvas.parentNode.insertBefore(div, this.canvas.nextSibling);
    return div;
  }

  _createLiveRegion() {
    const live = document.createElement('div');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    this.container.appendChild(live);
    return live;
  }

  registerEntity({ id, label, role = 'button', mesh, onActivate }) {
    // Avoid duplicate registration
    if (this.entities.has(id)) {
      this.unregisterEntity(id);
    }

    const isNativeButton = role === 'button';
    const el = document.createElement(isNativeButton ? 'button' : 'div');
    el.id = `a11y-${id}`;
    el.setAttribute('aria-label', label);

    if (!isNativeButton) {
      el.setAttribute('role', role);
      el.tabIndex = 0;
    }

    el.addEventListener('focus', () => {
      this.focusedEntityId = id;
      if (mesh && mesh.userData) {
        mesh.userData.hasA11yFocus = true;
      }
      // Note: Do NOT announce focus via live region.
      // Screen readers natively speak the aria-label of the focused element.
    });

    el.addEventListener('blur', () => {
      if (this.focusedEntityId === id) {
        this.focusedEntityId = null;
      }
      if (mesh && mesh.userData) {
        mesh.userData.hasA11yFocus = false;
      }
    });

    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (onActivate) onActivate();
      if (this.onObjectSelected) this.onObjectSelected(id);
    });

    if (!isNativeButton) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onActivate) onActivate();
          if (this.onObjectSelected) this.onObjectSelected(id);
        }
      });
    }

    this.container.appendChild(el);
    this.entities.set(id, { label, element: el, mesh });
  }

  unregisterEntity(id) {
    const entry = this.entities.get(id);
    if (entry) {
      if (entry.mesh && entry.mesh.userData) {
        entry.mesh.userData.hasA11yFocus = false;
      }
      if (entry.element && entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
      this.entities.delete(id);
      if (this.focusedEntityId === id) {
        this.focusedEntityId = null;
      }
    }
  }

  updateLabel(id, newLabel) {
    const entry = this.entities.get(id);
    if (entry) {
      entry.label = newLabel;
      entry.element.setAttribute('aria-label', newLabel);
    }
  }

  announce(message) {
    // Use strictly for dynamic transit status events (e.g. "Train 4 arrived at Track 2")
    this.liveRegion.textContent = message;
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.entities.clear();
    this.focusedEntityId = null;
  }
}
