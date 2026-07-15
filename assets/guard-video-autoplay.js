/**
 * Force muted autoplay for Guard Labs videos (Safari / Chrome policies).
 * Requires muted + playsinline in HTML; then calls play() when in view.
 */
(function () {
  function playVideo(video) {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        // Autoplay blocked (e.g. iOS Low Power Mode) — leave poster/first frame.
      });
    }
  }

  function initGuardVideos(root) {
    var scope = root || document;
    var videos = scope.querySelectorAll('[data-guard-video][data-autoplay="true"], video.guard-ugc__video[autoplay], video.guard-hero-video__media[autoplay]');

    if (!videos.length) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var video = entry.target;
            if (entry.isIntersecting) {
              playVideo(video);
            } else if (!video.hasAttribute('data-keep-playing-offscreen')) {
              video.pause();
            }
          });
        },
        { threshold: 0.25 }
      );

      videos.forEach(function (video) {
        observer.observe(video);
      });
    } else {
      videos.forEach(playVideo);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initGuardVideos();
    });
  } else {
    initGuardVideos();
  }

  document.addEventListener('shopify:section:load', function (event) {
    initGuardVideos(event.target);
  });
})();
