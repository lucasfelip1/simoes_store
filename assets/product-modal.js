if (!customElements.get('product-modal')) {
  customElements.define('product-modal', class ProductModal extends ModalDialog {
    constructor() {
      super();
      this.modalKeyHandler = this.onKeyDown.bind(this);
      this.imageZoom = null;
      this.minZoom = 1;
      this.maxZoom = 4;
      this.zoomStep = 0.35;
      this.preventModalCloseOnContentInteraction();
    }

    preventModalCloseOnContentInteraction() {
      const dialog = this.querySelector('.product-media-modal__dialog');
      if (!dialog) return;

      dialog.addEventListener('pointerup', (event) => {
        if (event.target.closest(
          '.product-media-modal__content, .product-media-modal__nav, .product-media-modal__zoom-toolbar, .product-media-modal__toggle, .product-media-modal__counter'
        )) {
          event.stopPropagation();
        }
      });
    }

    hide() {
      document.removeEventListener('keydown', this.modalKeyHandler);
      this.resetImageZoom();
      document.dispatchEvent(new CustomEvent('product-modal:close'));
      super.hide();
    }

    show(opener) {
      super.show(opener);
      document.dispatchEvent(new CustomEvent('product-modal:open'));
      document.addEventListener('keydown', this.modalKeyHandler);
      this.showActiveMedia();
      this.updateNavigationState();
    }

    showActiveMedia() {
      const activeMediaId = this.openedBy.getAttribute('data-media-id');
      const visibleMedia = this.getVisibleModalMedia();
      const modalContent = this.querySelector('.product-media-modal__content');

      modalContent.querySelectorAll('[data-media-id]').forEach((element) => {
        element.classList.remove('active');
      });

      const activeMedia = modalContent.querySelector(`[data-media-id="${activeMediaId}"]`);
      if (!activeMedia) return;

      activeMedia.classList.add('active');
      this.resetImageZoom();
      this.setupImageZoom(activeMedia);

      if (activeMedia.nodeName === 'DEFERRED-MEDIA') {
        const activeMediaTemplate = activeMedia.querySelector('template');
        const activeMediaContent = activeMediaTemplate ? activeMediaTemplate.content : null;
        if (activeMediaContent && activeMediaContent.querySelector('.js-youtube')) {
          activeMedia.loadContent();
        } else {
          activeMedia.loadContent(false);
        }
      } else if (activeMedia.querySelector('deferred-media')) {
        activeMedia.querySelector('deferred-media').loadContent(false);
      }

      this.updateNavigationState(visibleMedia, activeMediaId);
    }

    getZoomElements(activeMedia) {
      const stage = activeMedia.querySelector('.product-media-modal__zoom-stage');
      const image = activeMedia.querySelector('.product-media-modal__zoom-image');
      if (!stage || !image) return null;
      return { stage, image };
    }

    setupImageZoom(activeMedia) {
      const zoom = this.getZoomElements(activeMedia);
      const toolbar = this.querySelector('.product-media-modal__zoom-toolbar');

      if (!zoom) {
        if (toolbar) toolbar.hidden = true;
        return;
      }

      this.imageZoom = {
        stage: zoom.stage,
        image: zoom.image,
        scale: 1,
        translateX: 0,
        translateY: 0,
        isDragging: false,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0
      };

      if (toolbar) toolbar.hidden = false;
      this.applyImageZoom();
      this.bindImageZoomEvents(zoom.stage);
    }

    bindImageZoomEvents(stage) {
      if (stage.dataset.zoomBound === 'true') return;
      stage.dataset.zoomBound = 'true';

      stage.addEventListener('wheel', this.onZoomWheel.bind(this), { passive: false });
      stage.addEventListener('click', this.onZoomClick.bind(this));
      stage.addEventListener('pointerdown', this.onZoomPointerDown.bind(this));
      stage.addEventListener('pointermove', this.onZoomPointerMove.bind(this));
      stage.addEventListener('pointerup', this.onZoomPointerUp.bind(this));
      stage.addEventListener('pointercancel', this.onZoomPointerUp.bind(this));
    }

    onZoomClick(event) {
      if (!this.imageZoom) return;
      event.stopPropagation();
      if (this.imageZoom.isDragging) return;

      if (this.imageZoom.scale > 1) {
        this.setZoom(1);
      } else {
        this.setZoom(2);
      }
    }

    onZoomWheel(event) {
      if (!this.imageZoom) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY > 0 ? -this.zoomStep : this.zoomStep;
      this.changeZoom(delta);
    }

    onZoomPointerDown(event) {
      if (!this.imageZoom || this.imageZoom.scale <= 1) return;
      event.stopPropagation();
      this.imageZoom.isDragging = true;
      this.imageZoom.startX = event.clientX;
      this.imageZoom.startY = event.clientY;
      this.imageZoom.originX = this.imageZoom.translateX;
      this.imageZoom.originY = this.imageZoom.translateY;
      this.imageZoom.stage.setPointerCapture(event.pointerId);
      this.imageZoom.stage.classList.add('is-dragging');
    }

    onZoomPointerMove(event) {
      if (!this.imageZoom || !this.imageZoom.isDragging) return;
      event.stopPropagation();
      this.imageZoom.translateX = this.imageZoom.originX + (event.clientX - this.imageZoom.startX);
      this.imageZoom.translateY = this.imageZoom.originY + (event.clientY - this.imageZoom.startY);
      this.applyImageZoom();
    }

    onZoomPointerUp(event) {
      if (!this.imageZoom || !this.imageZoom.isDragging) return;
      this.imageZoom.isDragging = false;
      this.imageZoom.stage.classList.remove('is-dragging');
      if (event.pointerId) {
        try {
          this.imageZoom.stage.releasePointerCapture(event.pointerId);
        } catch (e) {}
      }
    }

    changeZoom(delta) {
      if (!this.imageZoom) return;
      this.setZoom(this.imageZoom.scale + delta);
    }

    setZoom(scale) {
      if (!this.imageZoom) return;
      const nextScale = Math.min(this.maxZoom, Math.max(this.minZoom, scale));
      this.imageZoom.scale = nextScale;
      if (nextScale === 1) {
        this.imageZoom.translateX = 0;
        this.imageZoom.translateY = 0;
      }
      this.applyImageZoom();
      this.updateZoomResetLabel();
    }

    applyImageZoom() {
      if (!this.imageZoom) return;
      const { image, stage, scale } = this.imageZoom;
      image.style.transform = `translate(${this.imageZoom.translateX}px, ${this.imageZoom.translateY}px) scale(${scale})`;
      stage.classList.toggle('is-zoomed', scale > 1);
      this.updateZoomResetLabel();
    }

    updateZoomResetLabel() {
      const resetButton = this.querySelector('[data-zoom-action="reset"]');
      if (!resetButton || !this.imageZoom) return;
      resetButton.textContent = `${Math.round(this.imageZoom.scale * 100)}%`;
    }

    resetImageZoom(keepToolbar) {
      if (this.imageZoom) {
        this.imageZoom.image.style.transform = '';
        this.imageZoom.stage.classList.remove('is-zoomed', 'is-dragging');
      }
      this.imageZoom = null;

      const resetButton = this.querySelector('[data-zoom-action="reset"]');
      if (resetButton) resetButton.textContent = '100%';

      const toolbar = this.querySelector('.product-media-modal__zoom-toolbar');
      if (toolbar && !keepToolbar) toolbar.hidden = true;
    }

    getVisibleModalMedia() {
      return Array.from(this.querySelectorAll('.product-media-modal__content [data-media-id]')).filter((element) => {
        return !element.classList.contains('product__media-item--variant');
      });
    }

    getOpenerForMediaId(mediaId) {
      return document.querySelector(`modal-opener [data-media-id="${mediaId}"]`);
    }

    navigateMedia(direction) {
      const visibleMedia = this.getVisibleModalMedia();
      const currentId = this.openedBy.getAttribute('data-media-id');
      const currentIndex = visibleMedia.findIndex((media) => media.dataset.mediaId === currentId);
      if (currentIndex < 0) return;

      const nextIndex = (currentIndex + direction + visibleMedia.length) % visibleMedia.length;
      const nextMediaId = visibleMedia[nextIndex].dataset.mediaId;
      const nextOpener = this.getOpenerForMediaId(nextMediaId);

      if (nextOpener) {
        this.openedBy = nextOpener;
        window.pauseAllMedia();
        this.showActiveMedia();
      }
    }

    updateNavigationState(visibleMedia = this.getVisibleModalMedia(), activeMediaId = this.openedBy?.getAttribute('data-media-id')) {
      const currentIndex = visibleMedia.findIndex((media) => media.dataset.mediaId === activeMediaId);
      const counter = this.querySelector('.product-media-modal__counter--current');
      const total = this.querySelector('.product-media-modal__counter--total');
      const prevButton = this.querySelector('.product-media-modal__nav--prev');
      const nextButton = this.querySelector('.product-media-modal__nav--next');
      const toolbar = this.querySelector('.product-media-modal__zoom-toolbar');
      const activeMedia = this.querySelector(`.product-media-modal__content [data-media-id="${activeMediaId}"]`);
      const isImage = activeMedia && activeMedia.querySelector('.product-media-modal__zoom-image');

      if (counter) counter.textContent = currentIndex >= 0 ? currentIndex + 1 : 1;
      if (total) total.textContent = visibleMedia.length;

      const hasMultiple = visibleMedia.length > 1;
      if (prevButton) prevButton.toggleAttribute('hidden', !hasMultiple);
      if (nextButton) nextButton.toggleAttribute('hidden', !hasMultiple);
      if (toolbar) toolbar.hidden = !isImage;
    }

    onKeyDown(event) {
      if (!this.hasAttribute('open')) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.navigateMedia(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.navigateMedia(1);
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        this.changeZoom(this.zoomStep);
      }
      if (event.key === '-') {
        event.preventDefault();
        this.changeZoom(-this.zoomStep);
      }
      if (event.key === '0') {
        event.preventDefault();
        this.setZoom(1);
      }
    }

    connectedCallback() {
      super.connectedCallback();

      const prevButton = this.querySelector('.product-media-modal__nav--prev');
      const nextButton = this.querySelector('.product-media-modal__nav--next');
      if (prevButton) prevButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.navigateMedia(-1);
      });
      if (nextButton) nextButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.navigateMedia(1);
      });

      this.querySelectorAll('[data-zoom-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const action = button.dataset.zoomAction;
          if (!this.imageZoom && action !== 'reset') {
            const activeMedia = this.querySelector('.product-media-modal__content .active[data-media-id]');
            if (activeMedia) this.setupImageZoom(activeMedia);
          }
          if (action === 'in') this.changeZoom(this.zoomStep);
          if (action === 'out') this.changeZoom(-this.zoomStep);
          if (action === 'reset') this.setZoom(1);
        });
      });
    }
  });
}
