# EyeAAC — Assistive Communication Tool

Eye and head-tracking AAC (Augmentative & Alternative Communication) app.
Move the cursor by moving your head. Click by blinking.

## Project Structure

```
eye-aac/
├── app.py               # Flask backend
├── requirements.txt     # Python deps
├── render.yaml          # Render deployment config
├── templates/
│   └── index.html       # Main UI (tracker module)
└── static/
    └── js/
        └── tracker.js   # Tracking logic (reusable module)
```

## Modules (build order)

- [x] **Module 1** — Camera tracking (head movement + blink detection)
- [ ] **Module 2** — Word grid UI with large fonts
- [ ] **Module 3** — Sentence builder + clipboard
- [ ] **Module 4** — AI next-word prediction

## Local Setup

```bash
git clone <your-repo>
cd eye-aac
pip install -r requirements.txt
python app.py
# Open http://localhost:5000
```

## Deploy to Render

1. Push to GitHub
2. New Web Service on render.com → connect repo
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app:app`
5. HTTPS is automatic (required for camera access)

## Calibration

1. Open the app and allow camera access
2. Look straight ahead at screen center
3. Click **Calibrate** — this sets your neutral position
4. Move head to aim the blue cursor
5. Blink deliberately to click

## Tuning for the User

All sliders adjust in real-time without refreshing:

| Setting | Description | Start low if… |
|---|---|---|
| Blink Sensitivity | EAR threshold | Accidental blinks triggering |
| Cursor Sensitivity | Head movement amplification | Cursor too slow |
| Smoothing | Jitter reduction | Cursor too shaky |
| Blink Cooldown | Min ms between blinks | Double-blinks registering |
