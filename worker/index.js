const TEXT_MODEL = '@cf/qwen/qwen2.5-coder-32b-instruct';
const VISION_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';

const SYSTEM_PROMPT = `You are the LAMZ Portfolio Assistant: a concise, thoughtful guide built into Lamz's personal portfolio.

IDENTITY
- The portfolio owner goes by Lamz; initials: A.A.A.
- The portfolio displays the age marker 17+.
- Lamz's listed creative and technical areas are JavaScript Development, Typography Editing, Photo Editing, Creative Design, Digital Content Editing, and Web Development.
- This portfolio does not provide verified employment history, client names, awards, certifications, education, or project case studies. Never invent any of those details.

YOUR ROLE
- Help visitors understand the portfolio, its visual direction, the listed skills, the showcase placeholders, and the available contact channels.
- You may help with general creative, typography, design, image-editing, and front-end development questions. The text model is code-oriented, but do not pretend to have inspected the website's source unless it is provided in the conversation.
- When asked to contact Lamz, point visitors to Telegram: https://t.me/ryumr. Other public links: GitHub https://github.com/Lanzh12, TikTok https://vm.tiktok.com/ZS9fJ7uMmxU2Q-bt9yv/, Instagram https://www.instagram.com/lamwht156?dlrf=MWZoMTR1amk2ampsNA==.
- The showcase thumbnails are placeholders, not proof of completed client work. Say so clearly when relevant.

STYLE
- Speak in natural, polished English. Be warm, direct, quietly confident, and useful. Avoid hype, fake testimonials, inflated claims, generic AI filler, and repetitive disclaimers.
- Keep most answers between 2 and 6 sentences. Use short lists only when they genuinely improve clarity.
- If a visitor writes in another language, reply in that language while keeping the same voice.
- Do not request passwords, API keys, payment details, or unnecessary personal information.
- If you do not know a personal fact about Lamz, say it is not listed on the portfolio instead of guessing.

IMAGE INPUT
- When an image is attached, describe only what is visibly present. Offer practical visual feedback when asked. Do not claim the image is Lamz's work unless the visitor explicitly says so.
- Do not infer sensitive personal traits or identify people in an image.

You represent the portfolio, not a real-time messaging account. Never claim that Lamz is online, has read a message, or will reply by a particular time.`;

const MAX_MESSAGES = 10;
const MAX_TEXT_LENGTH = 1200;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function json(data, status = 200, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function decodeImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') throw new Error('The attached image is invalid.');
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !ALLOWED_IMAGE_TYPES.has(match[1])) throw new Error('Only JPG, PNG and WebP images are supported.');
  const binary = atob(match[2]);
  if (binary.length > MAX_IMAGE_BYTES) throw new Error('The image must be smaller than 3 MB.');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return [...bytes];
}

function cleanMessages(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(-MAX_MESSAGES).flatMap((item) => {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') return [];
    const content = item.content.trim().slice(0, MAX_TEXT_LENGTH);
    return content ? [{ role: item.role, content }] : [];
  });
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname !== '/api/chat') return json({ error: 'Not found.' }, 404);

    const origin = request.headers.get('Origin') || '';
    if (!sameOrigin(request)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          ...(origin ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {})
        }
      });
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);
    if (!env.AI || typeof env.AI.run !== 'function') return json({ error: 'Workers AI is not configured for this deployment.' }, 503, origin);

    let body;
    try {
      const declaredLength = Number(request.headers.get('Content-Length') || 0);
      if (declaredLength > 5 * 1024 * 1024) return json({ error: 'Request is too large.' }, 413, origin);
      body = await request.json();
    } catch {
      return json({ error: 'Please send a valid JSON request.' }, 400, origin);
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_TEXT_LENGTH) : '';
    const messages = cleanMessages(body.messages);
    if (!prompt && !body.image) return json({ error: 'Write a message or attach an image to continue.' }, 400, origin);

    try {
      let result;
      if (body.image) {
        const image = decodeImageDataUrl(body.image);
        const imagePrompt = `${SYSTEM_PROMPT}\n\nA visitor attached an image to this portfolio chat. ${prompt || 'Describe what is visible in the image and offer a concise, neutral observation.'}`;
        result = await env.AI.run(VISION_MODEL, {
          image,
          prompt: imagePrompt,
          max_tokens: 420
        });
      } else {
        const safeMessages = messages.length ? messages : [{ role: 'user', content: prompt }];
        if (safeMessages[safeMessages.length - 1]?.role !== 'user') {
          safeMessages.push({ role: 'user', content: prompt });
        }
        result = await env.AI.run(TEXT_MODEL, {
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...safeMessages],
          max_tokens: 600,
          temperature: 0.65,
          top_p: 0.9
        });
      }

      const response = result?.response || result?.description || result?.output_text || result?.text;
      if (!response || typeof response !== 'string') throw new Error('The model returned an empty response.');
      return json({ response }, 200, origin);
    } catch (error) {
      console.error('LAMZ AI request failed:', error);
      const message = String(error?.message || '').toLowerCase().includes('llava')
        ? 'The image model is currently unavailable. Try again later or use text chat.'
        : 'The assistant is having trouble right now. Please try again in a moment.';
      return json({ error: message }, 502, origin);
    }
  }
};
