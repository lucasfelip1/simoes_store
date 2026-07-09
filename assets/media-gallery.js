if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.elements = {
        liveRegion: this.querySelector('[id^="GalleryStatus"]'),
        viewer: this.querySelector('[id^="GalleryViewer"]'),
        thumbnails: this.querySelector('[id^="GalleryThumbnails"]'),
        dots: this.querySelector('.product-gallery__dots'),
        controls: this.querySelector('.product-gallery__controls')
      };
      this.mql = window.matchMedia('(min-width: 750px)');
      this.mediaCount = parseInt(this.dataset.mediaCount, 10) || 0;
      this.autoplayUserPaused = false;
      this.isAutoplayTick = false;

      if (this.elements.viewer) {
        this.elements.viewer.addEventListener('slideChanged', debounce(this.onSlideChanged.bind(this), 500));
      }

      if (this.elements.thumbnails) {
        this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
          mediaToSwitch.querySelector('button').addEventListener('click', () => {
            this.onUserInteraction();
            this.setActiveMedia(mediaToSwitch.dataset.target, false);
          });
        });
        if (this.dataset.desktopLayout.includes('thumbnail') && this.mql.matches) this.removeListSemantic();
      }

      if (this.elements.dots) {
        this.elements.dots.querySelectorAll('.product-gallery__dot').forEach((dot) => {
          dot.addEventListener('click', () => {
            this.onUserInteraction();
            this.setActiveMedia(dot.dataset.target, false);
          });
        });
      }

      this.querySelectorAll('[data-gallery-nav]').forEach((button) => {
        button.addEventListener('click', () => {
          this.onUserInteraction();
          this.navigateByDirection(button.dataset.galleryNav === 'next' ? 1 : -1);
        });
      });

      this.querySelectorAll('.product__modal-opener--image').forEach((opener) => {
        opener.addEventListener('click', (event) => {
          if (event.target.closest('[data-gallery-nav], .product-gallery__arrow')) return;
          const button = opener.querySelector('[data-media-id]');
          const modal = document.querySelector(opener.getAttribute('data-modal'));
          if (modal && button) {
            event.preventDefault();
            modal.show(button);
          }
        });
      });

      this.initAutoplay();

      const activeSlide = this.getMediaSlides().find((slide) => slide.classList.contains('is-active'));
      if (activeSlide) this.playActiveMedia(activeSlide);
    }

    initAutoplay() {
      const autoplayEnabled = this.dataset.enableAutoplay === 'true';
      if (!autoplayEnabled || this.mediaCount < 2) return;

      this.autoplaySpeed = (parseInt(this.dataset.autoplaySpeed, 10) || 4) * 1000;
      this.autoplayButton = this.querySelector('.product-gallery__autoplay');

      if (this.autoplayButton) {
        this.autoplayButton.addEventListener('click', this.toggleAutoplay.bind(this));
      }

      const viewerWrap = this.querySelector('.product-gallery__viewer-wrap');
      if (viewerWrap) {
        viewerWrap.addEventListener('mouseenter', this.pauseAutoplay.bind(this));
        viewerWrap.addEventListener('mouseleave', this.resumeAutoplay.bind(this));
        viewerWrap.addEventListener('focusin', this.pauseAutoplay.bind(this));
        viewerWrap.addEventListener('focusout', this.focusOutAutoplay.bind(this));
      }

      document.addEventListener('product-modal:open', this.pauseAutoplay.bind(this));
      document.addEventListener('product-modal:close', this.resumeAutoplay.bind(this));

      this.playAutoplay();
    }

    getMediaSlides() {
      if (!this.elements.viewer) return [];
      return Array.from(this.elements.viewer.querySelectorAll('.product__media-item[data-media-id]'));
    }

    getActiveSlideIndex() {
      const slides = this.getMediaSlides();
      const activeSlide = slides.find((slide) => slide.classList.contains('is-active'));
      return activeSlide ? slides.indexOf(activeSlide) : 0;
    }

    navigateByDirection(direction) {
      const slides = this.getMediaSlides();
      if (slides.length < 2) return;

      const currentIndex = this.getActiveSlideIndex();
      const nextIndex = (currentIndex + direction + slides.length) % slides.length;
      this.setActiveMedia(slides[nextIndex].dataset.mediaId, false);
    }

    advanceAutoplay() {
      this.isAutoplayTick = true;
      this.navigateByDirection(1);
      this.isAutoplayTick = false;
    }

    onUserInteraction() {
      if (!this.isAutoplayTick) {
        this.pauseAutoplayTemporarily();
        this.resumeAutoplay();
      }
    }

    playAutoplay() {
      if (this.dataset.enableAutoplay !== 'true' || this.autoplayUserPaused) return;
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = setInterval(this.advanceAutoplay.bind(this), this.autoplaySpeed);
      this.toggleAutoplayButtonState(false);
    }

    pauseAutoplay() {
      clearInterval(this.autoplayTimer);
      if (!this.autoplayUserPaused) this.toggleAutoplayButtonState(true);
    }

    pauseAutoplayTemporarily() {
      clearInterval(this.autoplayTimer);
    }

    resumeAutoplay() {
      if (this.autoplayUserPaused) return;
      this.playAutoplay();
    }

    focusOutAutoplay(event) {
      const viewerWrap = this.querySelector('.product-gallery__viewer-wrap');
      if (!viewerWrap || viewerWrap.contains(event.relatedTarget)) return;
      this.resumeAutoplay();
    }

    toggleAutoplay() {
      this.autoplayUserPaused = !this.autoplayUserPaused;
      if (this.autoplayUserPaused) {
        this.pauseAutoplay();
        this.toggleAutoplayButtonState(true);
      } else {
        this.playAutoplay();
      }
    }

    toggleAutoplayButtonState(isPaused) {
      if (!this.autoplayButton) return;
      this.autoplayButton.classList.toggle('product-gallery__autoplay--paused', isPaused);
      this.autoplayButton.setAttribute(
        'aria-label',
        isPaused ? window.accessibilityStrings.playSlideshow : window.accessibilityStrings.pauseSlideshow
      );
    }

    onSlideChanged(event) {
      const thumbnail = this.elements.thumbnails?.querySelector(`[data-target="${event.detail.currentElement.dataset.mediaId}"]`);
      this.setActiveThumbnail(thumbnail);
      this.setActiveDot(event.detail.currentElement.dataset.mediaId);
      this.updateCounter(event.detail.currentPage);
    }

    setActiveMedia(mediaId, prepend) {
      const activeMedia = this.elements.viewer.querySelector(`[data-media-id="${mediaId}"]`);
      if (!activeMedia) return;

      this.elements.viewer.querySelectorAll('.product__media-item[data-media-id]').forEach((element) => {
        element.classList.remove('is-active');
      });
      activeMedia.classList.add('is-active');

      if (prepend) {
        activeMedia.parentElement.prepend(activeMedia);
        if (this.elements.thumbnails) {
          const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
          activeThumbnail.parentElement.prepend(activeThumbnail);
        }
        if (this.elements.viewer.slider) this.elements.viewer.resetPages();
      }

      this.preventStickyHeader();
      window.setTimeout(() => {
        if (this.elements.thumbnails) {
          activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft, behavior: 'smooth' });
        }
        if (!this.elements.thumbnails || this.dataset.desktopLayout === 'stacked') {
          activeMedia.scrollIntoView({ behavior: 'smooth' });
        }
      });
      this.playActiveMedia(activeMedia);

      if (this.elements.thumbnails) {
        const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
        this.setActiveThumbnail(activeThumbnail);
        if (activeThumbnail) this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
      }

      this.setActiveDot(mediaId);
      const slides = this.getMediaSlides();
      const activeIndex = slides.findIndex((slide) => slide.dataset.mediaId === mediaId);
      if (activeIndex >= 0) this.updateCounter(activeIndex + 1);
    }

    setActiveDot(mediaId) {
      if (!this.elements.dots) return;
      this.elements.dots.querySelectorAll('.product-gallery__dot').forEach((dot) => {
        const isActive = dot.dataset.target === mediaId;
        dot.classList.toggle('product-gallery__dot--active', isActive);
        if (isActive) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });
    }

    updateCounter(currentPage) {
      const counter = this.elements.controls?.querySelector('.slider-counter--current');
      if (counter) counter.textContent = currentPage;
    }

    setActiveThumbnail(thumbnail) {
      if (!this.elements.thumbnails || !thumbnail) return;

      this.elements.thumbnails.querySelectorAll('button').forEach((element) => element.removeAttribute('aria-current'));
      thumbnail.querySelector('button').setAttribute('aria-current', true);
      if (this.elements.thumbnails.isSlideVisible(thumbnail, 10)) return;

      this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
    }

    announceLiveRegion(activeItem, position) {
      const image = activeItem.querySelector('.product__modal-opener--image img');
      if (!image || !this.elements.liveRegion) return;
      image.onload = () => {
        this.elements.liveRegion.setAttribute('aria-hidden', false);
        this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace(
          '[index]',
          position
        );
        setTimeout(() => {
          this.elements.liveRegion.setAttribute('aria-hidden', true);
        }, 2000);
      };
      image.src = image.src;
    }

    playActiveMedia(activeItem) {
      window.pauseAllMedia();

      const container = activeItem.querySelector('.product-media-container');
      if (!container) return;

      const isVideo = container.classList.contains('media-type-video') || container.classList.contains('media-type-external_video');
      if (!isVideo) return;

      const deferredMedia = container.querySelector('.deferred-media');
      if (!deferredMedia) return;

      deferredMedia.loadContent(false);

      const video = deferredMedia.querySelector('video');
      if (video) {
        video.muted = true;
        video.setAttribute('playsinline', '');
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) playPromise.catch(() => {});
      }
    }

    preventStickyHeader() {
      this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
      if (!this.stickyHeader) return;
      this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
    }

    removeListSemantic() {
      if (!this.elements.viewer.slider) return;
      this.elements.viewer.slider.setAttribute('role', 'presentation');
      this.elements.viewer.sliderItems.forEach((slide) => slide.setAttribute('role', 'presentation'));
    }
  });
}
