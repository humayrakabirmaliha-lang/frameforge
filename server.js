const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/generate', async (req, res) => {
  const { prompt, style, duration, aspect_ratio } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not set' });

  try {
    const fullPrompt = style ? `${prompt}, ${style}` : prompt;

    const submitRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        duration: duration || '8',
        aspect_ratio: aspect_ratio || '16:9'
      })
    });

    const submitData = await submitRes.json();
    if (!submitData.request_id) return res.status(500).json({ error: 'Failed to submit', details: submitData });

    const requestId = submitData.request_id;
    let result = null;
    let attempts = 0;

    while (attempts < 60) {
      await new Promise(r => setTimeout(r, 5000));
      attempts++;

      const pollRes = await fetch(`https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });

      const pollData = await pollRes.json();
      if (pollData.status === 'COMPLETED') { result = pollData; break; }
      if (pollData.status === 'FAILED') return res.status(500).json({ error: 'Failed', details: pollData });
    }

    if (!result) return res.status(504).json({ error: 'Timeout' });

    const videoUrl = result?.video?.url || result?.output?.video?.url;
    return res.json({ success: true, videoUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/image-to-video', async (req, res) => {
  const { imageUrl, prompt } = req.body;
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not set' });

  try {
    const submitRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v1.6/standard/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: prompt || 'Animate with smooth cinematic motion',
        duration: '8',
        aspect_ratio: '16:9'
      })
    });

    const submitData = await submitRes.json();
    if (!submitData.request_id) return res.status(500).json({ error: 'Failed', details: submitData });

    const requestId = submitData.request_id;
    let result = null;
    let attempts = 0;

    while (attempts < 60) {
      await new Promise(r => setTimeout(r, 5000));
      attempts++;

      const pollRes = await fetch(`https://queue.fal.run/fal-ai/kling-video/v1.6/standard/image-to-video/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });

      const pollData = await pollRes.json();
      if (pollData.status === 'COMPLETED') { result = pollData; break; }
      if (pollData.status === 'FAILED') return res.status(500).json({ error: 'Failed' });
    }

    if (!result) return res.status(504).json({ error: 'Timeout' });

    const videoUrl = result?.video?.url || result?.output?.video?.url;
    return res.json({ success: true, videoUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FrameForge running on port ${PORT}`));
