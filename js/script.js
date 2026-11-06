'use strict';

const AI_ENDPOINT = '/api/chat';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

// Remove the intro loader after the first paint. This is intentionally non-blocking.
window.addEventListener('load', () => {
  window.setTimeout(() => $('.site-loader')?.classList.add('is-done'), 420);
}, { once: true });

// Mobile navigation.
const menuToggle = $('.menu-toggle');
const primaryNav = $('.primary-nav');
function closeMenu() {
  menuToggle?.setAttribute('aria-expanded', 'false');
  menuToggle?.setAttribute('aria-label', 'Open navigation');
  primaryNav?.classList.remove('is-open');
}
menuToggle?.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
  primaryNav?.classList.toggle('is-open', !isOpen);
});
$$('.primary-nav a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('click', (event) => {
  if (primaryNav?.classList.contains('is-open') && !event.target.closest('.site-header')) closeMenu();
});

// Reveal sections as they enter the viewport.
const revealItems = $$('.reveal');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index % 5, 4) * 55}ms`;
    revealObserver.observe(item);
  });
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

// Back-to-top visibility and footer year.
const backToTop = $('#back-to-top');
const currentYear = $('#current-year');
if (currentYear) currentYear.textContent = String(new Date().getFullYear());
window.addEventListener('scroll', () => {
  backToTop?.classList.toggle('is-visible', window.scrollY > 650);
}, { passive: true });
backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Native dialog for each showcase placeholder.
const workDialog = $('#work-dialog');
const dialogTitle = $('#dialog-title');
const dialogDescription = $('#dialog-description');
function openWorkDialog(card) {
  if (!workDialog || !dialogTitle || !dialogDescription) return;
  dialogTitle.textContent = card.dataset.title || 'Showcase detail';
  dialogDescription.textContent = card.dataset.description || 'Replace this placeholder with an original project description.';
  if (typeof workDialog.showModal === 'function') workDialog.showModal();
  else workDialog.setAttribute('open', '');
}
$$('.work-card').forEach((card) => card.addEventListener('click', () => openWorkDialog(card)));
$('#dialog-close-action')?.addEventListener('click', () => workDialog?.close());
workDialog?.addEventListener('click', (event) => {
  if (event.target === workDialog) workDialog.close();
});

// Gift video: muted autoplay is attempted, with an explicit fallback control.
const giftVideo = $('#gift-video');
const videoShell = $('.gift-video-shell');
const videoOverlay = $('#video-overlay');
const videoPlay = $('#video-play');
function setVideoPlaying(playing) {
  videoShell?.classList.toggle('is-playing', playing);
  if (videoPlay) {
    videoPlay.innerHTML = playing
      ? '<i class="fa-solid fa-pause" aria-hidden="true"></i><span>PAUSE VIDEO</span>'
      : '<i class="fa-solid fa-play" aria-hidden="true"></i><span>PLAY VIDEO</span>';
    videoPlay.setAttribute('aria-label', playing ? 'Pause gift video' : 'Play gift video');
  }
  if (videoOverlay) videoOverlay.hidden = false;
}
if (giftVideo) {
  giftVideo.muted = true;
  const attemptAutoplay = giftVideo.play();
  if (attemptAutoplay && typeof attemptAutoplay.then === 'function') {
    attemptAutoplay.then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
  }
  giftVideo.addEventListener('playing', () => setVideoPlaying(true));
  giftVideo.addEventListener('pause', () => setVideoPlaying(false));
  giftVideo.addEventListener('error', () => {
    setVideoPlaying(false);
    if (videoPlay) {
      videoPlay.innerHTML = '<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>VIDEO UNAVAILABLE</span>';
      videoPlay.disabled = true;
      videoPlay.setAttribute('aria-label', 'Gift video unavailable');
    }
  });
}
videoPlay?.addEventListener('click', async () => {
  if (!giftVideo || videoPlay.disabled) return;
  try {
    if (giftVideo.paused) {
      giftVideo.muted = true;
      await giftVideo.play();
    } else {
      giftVideo.pause();
    }
  } catch {
    setVideoPlaying(false);
  }
});

// Small desktop-only cursor accent; native pointer behaviour remains unchanged.
const cursorOrb = $('.cursor-orb');
const finePointer = window.matchMedia('(pointer: fine) and (hover: hover)');
if (cursorOrb && finePointer.matches) {
  window.addEventListener('pointermove', (event) => {
    cursorOrb.style.left = `${event.clientX}px`;
    cursorOrb.style.top = `${event.clientY}px`;
    cursorOrb.classList.add('is-visible');
  }, { passive: true });
  window.addEventListener('pointerdown', () => cursorOrb.classList.add('is-hovering'));
  window.addEventListener('pointerup', () => cursorOrb.classList.remove('is-hovering'));
  $$('a, button, input, textarea').forEach((item) => {
    item.addEventListener('mouseenter', () => cursorOrb.classList.add('is-hovering'));
    item.addEventListener('mouseleave', () => cursorOrb.classList.remove('is-hovering'));
  });
}

// LAMZ AI chat. The Cloudflare Worker keeps model calls and account credentials off the client.
const aiLauncher = $('#ai-launcher');
const aiPanel = $('#ai-panel');
const aiClose = $('#ai-close');
const aiForm = $('#ai-form');
const aiInput = $('#ai-input');
const aiMessages = $('#ai-messages');
const aiSend = $('#ai-send');
const aiImageInput = $('#ai-image');
const aiAttachmentName = $('#ai-attachment-name');
let selectedImage = null;
let chatHistory = [];

function setChatOpen(open) {
  aiLauncher?.setAttribute('aria-expanded', String(open));
  aiPanel?.classList.toggle('is-open', open);
  aiPanel?.setAttribute('aria-hidden', String(!open));
  if (open) window.setTimeout(() => aiInput?.focus(), 180);
}
aiLauncher?.addEventListener('click', () => setChatOpen(aiLauncher.getAttribute('aria-expanded') !== 'true'));
aiClose?.addEventListener('click', () => setChatOpen(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && aiPanel?.classList.contains('is-open')) setChatOpen(false);
});

function appendMessage(role, text, imageUrl = '') {
  const message = document.createElement('div');
  message.className = `ai-message ${role === 'user' ? 'ai-message-user' : 'ai-message-bot'}`;
  const tag = document.createElement('span');
  tag.className = 'ai-message-tag mono';
  tag.textContent = role === 'user' ? 'YOU' : 'LAMZ AI';
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  message.append(tag, paragraph);
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = 'Attached image preview';
    message.append(image);
  }
  aiMessages?.append(message);
  aiMessages?.scrollTo({ top: aiMessages.scrollHeight, behavior: 'smooth' });
  return message;
}

function setTyping(active) {
  const existing = $('.ai-typing', aiMessages);
  if (active && !existing) {
    const typing = document.createElement('div');
    typing.className = 'ai-typing';
    typing.setAttribute('aria-label', 'Assistant is typing');
    typing.innerHTML = '<i></i><i></i><i></i>';
    aiMessages?.append(typing);
  } else if (!active && existing) {
    existing.remove();
  }
  if (active) aiMessages?.scrollTo({ top: aiMessages.scrollHeight, behavior: 'smooth' });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

aiImageInput?.addEventListener('change', () => {
  const file = aiImageInput.files?.[0];
  if (!file) {
    selectedImage = null;
    aiAttachmentName.hidden = true;
    aiAttachmentName.textContent = '';
    return;
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
    appendMessage('assistant', 'Please choose a JPG, PNG or WebP image under 3 MB.');
    aiImageInput.value = '';
    selectedImage = null;
    aiAttachmentName.hidden = true;
    return;
  }
  selectedImage = file;
  aiAttachmentName.textContent = `ATTACHED · ${file.name}`;
  aiAttachmentName.hidden = false;
});

$$('.ai-suggestions button').forEach((button) => {
  button.addEventListener('click', () => {
    if (!aiInput) return;
    aiInput.value = button.dataset.prompt || '';
    aiInput.focus();
    aiInput.dispatchEvent(new Event('input'));
  });
});

aiInput?.addEventListener('input', () => {
  aiInput.style.height = 'auto';
  aiInput.style.height = `${Math.min(aiInput.scrollHeight, 90)}px`;
});
aiInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    aiForm?.requestSubmit();
  }
});

function extractAssistantText(payload) {
  const result = payload?.result ?? payload;
  if (typeof result === 'string') return result;
  return result?.response || result?.description || result?.output_text || result?.text || 'I could not find a response in the model output.';
}

aiForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = aiInput?.value.trim() || '';
  if ((!prompt && !selectedImage) || aiSend?.disabled) return;

  let imageData = '';
  const imageFile = selectedImage;
  if (imageFile) {
    try {
      imageData = await readFileAsDataUrl(imageFile);
    } catch (error) {
      appendMessage('assistant', error.message);
      return;
    }
  }

  const displayText = prompt || 'Please take a look at this image.';
  const previewUrl = imageData;
  appendMessage('user', displayText, previewUrl);
  chatHistory.push({ role: 'user', content: displayText });
  aiInput.value = '';
  aiInput.style.height = 'auto';
  selectedImage = null;
  if (aiImageInput) aiImageInput.value = '';
  if (aiAttachmentName) {
    aiAttachmentName.hidden = true;
    aiAttachmentName.textContent = '';
  }
  if ($('.ai-suggestions')) $('.ai-suggestions').hidden = true;

  aiSend.disabled = true;
  setTyping(true);
  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chatHistory.slice(-10),
        prompt: displayText,
        image: imageData || null
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = response.status === 404
        ? 'The AI service is not connected yet. Deploy the included Cloudflare Worker and enable its Workers AI binding, then try again.'
        : (payload.error || `The assistant could not respond (${response.status}).`);
      throw new Error(detail);
    }
    const reply = extractAssistantText(payload);
    setTyping(false);
    appendMessage('assistant', reply);
    chatHistory.push({ role: 'assistant', content: reply });
    chatHistory = chatHistory.slice(-10);
  } catch (error) {
    setTyping(false);
    const message = error instanceof TypeError
      ? 'The AI service could not be reached. Check the Worker deployment and connection, then try again.'
      : error.message;
    const errorNode = appendMessage('assistant', message);
    errorNode.classList.add('is-error');
    chatHistory.pop();
  } finally {
    aiSend.disabled = false;
    aiInput?.focus();
  }
});
  
