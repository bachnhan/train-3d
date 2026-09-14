/**
 * Reference Implementation: Accessible 3D Diorama Picker & Camera Controller
 * 
 * Implements 3D camera synchronization and accessible HTML twin controls.
 */

export class DioramaPicker {
  constructor({ containerElement, onFocusTarget } = {}) {
    this.container = containerElement;
    this.onFocusTarget = onFocusTarget;
    this.targets = new Map();
    this.activeId = null;

    this.navElement = null;
    if (this.container && typeof document !== 'undefined') {
      this._buildUI();
    }
  }

  _buildUI() {
    if (typeof document === 'undefined' || !this.container) return;
    this.navElement = document.createElement('nav');
    this.navElement.setAttribute('aria-label', '3D Diorama Scene Selector');
    this.navList = document.createElement('ul');
    this.navList.style.cssText = 'list-style: none; padding: 0; margin: 0; display: flex; gap: 8px; flex-wrap: wrap;';
    this.navElement.appendChild(this.navList);
    this.container.appendChild(this.navElement);
  }

  registerTarget({ id, name, description, camera }) {
    this.targets.set(id, { id, name, description, camera });

    if (this.navList && typeof document !== 'undefined') {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.id = `diorama-btn-${id}`;
      btn.textContent = name;
      btn.setAttribute('aria-label', `${name}: ${description}`);
      btn.style.cssText = 'padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 500;';

      btn.addEventListener('click', () => this.selectTarget(id));
      li.appendChild(btn);
      this.navList.appendChild(li);
    }
  }

  selectTarget(id) {
    const target = this.targets.get(id);
    if (!target) return;

    this.activeId = id;

    // Update active button state in DOM
    if (this.navList) {
      const buttons = this.navList.querySelectorAll('button');
      buttons.forEach(b => {
        const isCurrent = b.id === `diorama-btn-${id}`;
        b.setAttribute('aria-current', isCurrent ? 'true' : 'false');
      });
    }

    if (this.onFocusTarget) {
      this.onFocusTarget(target);
    }
  }

  destroy() {
    if (this.navElement && this.navElement.parentNode) {
      this.navElement.parentNode.removeChild(this.navElement);
    }
    this.navElement = null;
    this.navList = null;
    this.targets.clear();
    this.activeId = null;
    this.onFocusTarget = null;
  }

  // Camera Responsive Clamping: Adjusts camera distance for narrow viewports (320px, 390px)
  static computeResponsiveCameraDistance({ baseDistance, currentWidth, currentHeight, designAspect = 16 / 9 }) {
    const currentAspect = currentWidth / (currentHeight || 1);
    if (currentAspect < designAspect) {
      // Narrow portrait: pull camera back so the diorama doesn't clip horizontally
      return baseDistance * (designAspect / currentAspect);
    }
    return baseDistance;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DioramaPicker };
}
